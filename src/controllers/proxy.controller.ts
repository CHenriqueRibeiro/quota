import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import crypto from 'crypto';
import { addUsageJob } from '../lib/queue';
import { normalizeProvider, SUPPORTED_PROVIDERS, type SupportedProvider } from '../lib/providers';
import { callProvider } from '../lib/provider-client';
import { getPlanLimits } from '../config/plan-limits';

export class ProxyController {
  async execute(request: AuthenticatedRequest, reply: FastifyReply) {
    const body = request.body as any;
    const tenantId = request.tenantId ?? request.user?.tenantId;
    const quotaApiKey = request.apiKey;
    const headers = request.headers as any;

    const billingGroup = typeof headers['x-billing-group'] === 'string' ? headers['x-billing-group'].trim().slice(0, 100) : undefined;
    const agent = typeof headers['x-agent'] === 'string' ? headers['x-agent'].trim().slice(0, 100) : undefined;
    const project = typeof headers['x-project'] === 'string' ? headers['x-project'].trim().slice(0, 100) : undefined;
    const environment = typeof headers['x-environment'] === 'string' ? headers['x-environment'].trim().slice(0, 50) : undefined;
    const externalUserId = typeof headers['x-user-id'] === 'string' ? headers['x-user-id'].trim().slice(0, 100) : undefined;
    const requestGroup = typeof headers['x-request-group'] === 'string' ? headers['x-request-group'].trim().slice(0, 100) : undefined;
    const traceId = typeof headers['x-trace-id'] === 'string' && headers['x-trace-id'].trim() ? headers['x-trace-id'].trim().slice(0, 100) : crypto.randomUUID();

    const rawTags = headers['x-tags'] ? String(headers['x-tags']).split(',') : [];
    const tags = rawTags
      .map((t: string) => t.trim().replace(/[<>]/g, '').slice(0, 50))
      .filter((t: string) => t.length > 0)
      .slice(0, 20);

    const context = {
      billingGroup,
      agent,
      project,
      environment,
      externalUserId,
      requestGroup,
      traceId,
      tags,
    };

    const requestId = typeof body?.requestId === 'string' && body.requestId.trim() ? body.requestId.trim() : crypto.randomUUID();

    if (!quotaApiKey) {
      return reply.status(401).send({
        error: 'API Key do Quota não encontrada'
      });
    }

    const provider = quotaApiKey.provider;
    const model = String(body?.model ?? 'unknown').slice(0, 100);

    const allowed = Array.isArray(quotaApiKey.allowedModels) ? quotaApiKey.allowedModels : null;
    if (allowed && allowed.length > 0 && !allowed.includes(model)) {
      return reply.status(403).send({
        error: 'Modelo não permitido para esta API Key'
      });
    }

    if (!tenantId) {
      return reply.status(401).send({
        error: 'Tenant não encontrado para essa requisição'
      });
    }

    if (!SUPPORTED_PROVIDERS.some((item) => item.key === quotaApiKey.provider)) {
      return reply.status(400).send({
        error: 'Provider da API Key inválido'
      });
    }

    // 1. Obter Plano do Tenant com Cache Redis (TTL 1 hora)
    let plan = 'STARTER';
    const planCacheKey = `tenant:plan:${tenantId}`;
    try {
      const cachedPlan = await redis.get(planCacheKey);
      if (cachedPlan) {
        plan = cachedPlan;
      } else {
        const dbTenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true },
        });
        if (dbTenant?.plan) {
          plan = dbTenant.plan;
          await redis.set(planCacheKey, plan, 'EX', 3600);
        }
      }
    } catch {
      // fallback silencioso
    }

    const limits = getPlanLimits(plan as any);

    // 2. Checagem de Limite Mensal com Contador Atômico Redis
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyKey = `quota:monthly_count:${tenantId}:${monthStr}`;
    let currentMonthUsage = 0;

    try {
      const cachedCount = await redis.get(monthlyKey);
      if (cachedCount !== null) {
        currentMonthUsage = Number(cachedCount);
      } else {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        currentMonthUsage = await prisma.usageLog.count({
          where: {
            tenantId,
            createdAt: { gte: startOfMonth },
          },
        });
        await redis.set(monthlyKey, String(currentMonthUsage), 'EX', 86400 * 32);
      }
    } catch {
      // fallback
    }

    if (currentMonthUsage >= limits.monthlyRequests) {
      return reply.status(429).send({
        error: `Limite mensal de ${limits.monthlyRequests.toLocaleString('pt-BR')} requisições de IA atingido para o plano ${plan}. Faça upgrade para continuar utilizando.`
      });
    }

    if (context.tags && context.tags.length > limits.maxTagsPerRequest) {
      context.tags = context.tags.slice(0, limits.maxTagsPerRequest);
    }

    // Validação de Projeto e Agente cadastrados e Credencial do Provedor
    const [dbProject, dbAgent, dbCredential] = await Promise.all([
      context.project
        ? (prisma as any).project.findFirst({ where: { tenantId, name: context.project } })
        : Promise.resolve(true),
      context.agent
        ? (prisma as any).agent.findFirst({ where: { tenantId, name: context.agent } })
        : Promise.resolve(true),
      (async () => {
        const credCacheKey = `cred:cache:${quotaApiKey.providerCredentialId}`;
        try {
          const cachedCred = await redis.get(credCacheKey);
          if (cachedCred) return JSON.parse(cachedCred);
        } catch {}
        const fetched = await prisma.providerCredential.findUnique({
          where: { id: quotaApiKey.providerCredentialId },
        });
        if (fetched && fetched.isActive) {
          try { await redis.set(credCacheKey, JSON.stringify(fetched), 'EX', 600); } catch {}
        }
        return fetched;
      })(),
    ]);

    if (context.project && !dbProject) {
      return reply.status(400).send({
        error: `Projeto '${context.project}' não está cadastrado no tenant.`
      });
    }

    if (context.agent && !dbAgent) {
      return reply.status(400).send({
        error: `Agente '${context.agent}' não está cadastrado no tenant.`
      });
    }

    const credential = dbCredential;
    if (!credential || !credential.isActive) {
      return reply.status(400).send({
        error: 'Provider credential não encontrado ou inativo'
      });
    }

    if (credential.provider !== provider) {
      return reply.status(400).send({
        error: 'Provider não corresponde à API Key'
      });
    }

    const customEndpoint =
      (typeof body?.endpoint === 'string' && body.endpoint.trim()) ||
      (typeof body?.path === 'string' && body.path.trim()) ||
      (typeof body?.targetUrl === 'string' && body.targetUrl.trim()) ||
      (typeof headers['x-endpoint'] === 'string' && headers['x-endpoint'].trim()) ||
      (typeof headers['x-path'] === 'string' && headers['x-path'].trim()) ||
      (typeof headers['x-target-url'] === 'string' && headers['x-target-url'].trim()) ||
      undefined;

    const providerPayload = { ...body };
    delete providerPayload.provider;
    delete providerPayload.requestId;
    delete providerPayload.billingGroup;
    delete providerPayload.apiKey;
    delete providerPayload.endpoint;
    delete providerPayload.path;
    delete providerPayload.targetUrl;

    let providerResult;
    const providerStartedAt = Date.now();

    try {
      providerResult = await callProvider({
        provider: credential.provider,
        apiKey: credential.apiKey,
        model,
        body: providerPayload,
        baseUrl: credential.baseUrl ?? undefined,
        endpoint: customEndpoint,
      });
    } catch (error) {
      request.log.error(error, 'Provider request failed');

      const failurePayload = {
        requestId,
        tenantId,
        apiKeyId: quotaApiKey.id,
        billingGroup: context.billingGroup,
        traceId: context.traceId,
        agent: context.agent,
        project: context.project,
        environment: context.environment,
        externalUserId: context.externalUserId,
        requestGroup: context.requestGroup,
        tags: context.tags,
        provider,
        model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        statusCode: 502,
        success: false,
        latencyMs: Date.now() - providerStartedAt,
      };

      try {
        await addUsageJob(failurePayload);
      } catch (jobError) {
        request.log.error({ jobError }, 'Failed to enqueue failure usage job');
      }

      return reply.status(502).send({
        error: 'Erro ao encaminhar para o provider',
        details: error instanceof Error ? error.message : error,
      });
    }

    const success = providerResult.statusCode >= 200 && providerResult.statusCode < 300;
    const statusCode = providerResult.statusCode;

    const jobPayload = {
      requestId,
      tenantId,
      apiKeyId: quotaApiKey.id,
      billingGroup: context.billingGroup,
      traceId: context.traceId,
      agent: context.agent,
      project: context.project,
      environment: context.environment,
      externalUserId: context.externalUserId,
      requestGroup: context.requestGroup,
      tags: context.tags,
      provider,
      model,
      promptTokens: providerResult.promptTokens,
      completionTokens: providerResult.completionTokens,
      totalTokens: providerResult.totalTokens,
      cachedTokens: providerResult.cachedTokens,
      reasoningTokens: providerResult.reasoningTokens,
      cacheCreationTokens: providerResult.cacheCreationTokens,
      statusCode,
      success,
      latencyMs: providerResult.latencyMs,
    };

    try {
      await addUsageJob(jobPayload);
    } catch (err) {
      request.log.error({ err }, 'Failed to enqueue usage job');
    }

    return reply.status(statusCode).send({
      provider,
      model,
      ...(customEndpoint && { endpoint: customEndpoint }),
      billingGroup,
      requestId,
      success,
      statusCode,
      latencyMs: providerResult.latencyMs,
      promptTokens: providerResult.promptTokens,
      completionTokens: providerResult.completionTokens,
      totalTokens: providerResult.totalTokens,
      cachedTokens: providerResult.cachedTokens,
      reasoningTokens: providerResult.reasoningTokens,
      cacheCreationTokens: providerResult.cacheCreationTokens,
      response: providerResult.body,
      supportedProviders: SUPPORTED_PROVIDERS.map((item) => item.key),
    });
  }
}