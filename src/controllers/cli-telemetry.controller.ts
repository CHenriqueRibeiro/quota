import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import { addUsageJob } from '../lib/queue';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { getPlanLimits } from '../config/plan-limits';
import type { ProviderName } from '@prisma/client';

export class CliTelemetryController {
  async execute(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const tenantId = request.user?.tenantId ?? request.tenantId;

      if (!tenantId) {
        return reply.status(403).send({ error: 'Tenant indisponível.' });
      }

      const rawProvider = (body?.provider ?? 'openai').toString().toLowerCase();
      const validProviders: ProviderName[] = ['openai', 'anthropic', 'google', 'groq', 'mistral'];
      const provider: ProviderName = validProviders.includes(rawProvider as ProviderName)
        ? (rawProvider as ProviderName)
        : 'openai';

      const model = body?.model ?? 'unknown-cli-model';

      const promptTokens = Number(body?.prompt_tokens ?? body?.promptTokens ?? 0);
      const completionTokens = Number(body?.completion_tokens ?? body?.completionTokens ?? 0);
      const cachedTokens = Number(body?.cached_tokens ?? body?.cachedTokens ?? 0);
      const cacheCreationTokens = Number(body?.cache_creation_tokens ?? body?.cacheCreationTokens ?? 0);
      const reasoningTokens = Number(body?.reasoning_tokens ?? body?.reasoningTokens ?? 0);
      const totalTokens = Number(body?.total_tokens ?? body?.totalTokens ?? promptTokens + completionTokens);

      const latencyMs = Number(body?.latency_ms ?? body?.latencyMs ?? 0);
      const statusCode = Number(body?.status_code ?? body?.statusCode ?? 200);

      // Verificação de limite mensal do plano
      const dbTenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true }
      });
      const limits = getPlanLimits(dbTenant?.plan);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthUsage = await prisma.usageLog.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth }
        }
      });

      if (currentMonthUsage >= limits.monthlyRequests) {
        return reply.status(429).send({
          error: `Limite mensal de ${limits.monthlyRequests.toLocaleString('pt-BR')} requisições ativadas para o plano ${dbTenant?.plan ?? 'STARTER'}. Faça upgrade para continuar.`
        });
      }

      // Metadados enriquecidos do token (CliKey)
      const cliMeta = request.cliKeyMeta ?? {};
      const agent = cliMeta.agent ?? body?.agent ?? null;
      const project = cliMeta.project ?? body?.project ?? null;
      const billingGroup = cliMeta.billingGroup ?? body?.billingGroup ?? null;
      const environment = cliMeta.environment ?? body?.environment ?? 'development';
      const tags = Array.isArray(cliMeta.tags) && cliMeta.tags.length > 0
        ? cliMeta.tags
        : Array.isArray(body?.tags) ? body.tags : [];

      const event = {
        source: 'cli-telemetry',
        tenantId,
        apiKeyId: null,

        traceId: body?.traceId ?? randomUUID(),
        requestId: body?.requestId ?? randomUUID(),

        provider,
        model,

        promptTokens,
        completionTokens,
        totalTokens,
        cachedTokens,
        reasoningTokens,
        cacheCreationTokens,

        latencyMs,
        estimatedCost: Number(body?.estimatedCost ?? body?.estimatedCostUsd ?? 0),
        statusCode,
        success: statusCode >= 200 && statusCode < 400,

        agent,
        project,
        billingGroup,
        environment,
        externalUserId: request.user?.id ?? body?.externalUserId ?? null,
        requestGroup: body?.requestGroup ?? 'cli-watch',
        tags
      };

      await addUsageJob(event);

      return reply.status(202).send({
        success: true,
        requestId: event.requestId
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao processar telemetria de CLI.' });
    }
  }

  async ping(request: AuthenticatedRequest, reply: FastifyReply) {
    return reply.send({
      success: true,
      message: 'Conexão com Quota CLI estabelecida com sucesso.',
      user: {
        id: request.user?.id,
        name: request.user?.name,
        email: request.user?.email,
        tenantId: request.tenantId
      },
      cliKeyMeta: request.cliKeyMeta
    });
  }
}
