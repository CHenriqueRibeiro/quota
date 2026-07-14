import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { addUsageJob } from '../lib/queue';
import { normalizeProvider, SUPPORTED_PROVIDERS, type SupportedProvider } from '../lib/providers';
import { callProvider } from '../lib/provider-client';

const prisma = new PrismaClient();

export class ProxyController {
  async execute(request: AuthenticatedRequest, reply: FastifyReply) {
    const body = request.body as any;

const tenantId = request.tenantId ?? request.user?.tenantId;

const quotaApiKey = request.apiKey;

const headers = request.headers as any;

const billingGroup = headers['x-billing-group'] as string | undefined;


const context = {
  billingGroup,
  agent: headers['x-agent'] as string | undefined,
  project: headers['x-project'] as string | undefined,
  environment: headers['x-environment'] as string | undefined,
  externalUserId: headers['x-user-id'] as string | undefined,
  requestGroup: headers['x-request-group'] as string | undefined,
  traceId: headers['x-trace-id'] as string ?? crypto.randomUUID(),
  tags: headers['x-tags']
    ? String(headers['x-tags']).split(',').map((tag: string) => tag.trim())
    : []
};


const requestId = body?.requestId ?? crypto.randomUUID?.() ?? `req_${Date.now()}`;


if (!quotaApiKey) {
  return reply.status(401).send({
    error: 'API Key do Quota não encontrada'
  });
}


const provider = quotaApiKey.provider;

const model = String(body?.model ?? 'unknown');

const allowed = Array.isArray(quotaApiKey.allowedModels)
  ? quotaApiKey.allowedModels
  : null;

if (allowed && allowed.length > 0 && !allowed.includes(model)) {
  return reply.status(403).send({
    error: "Modelo não permitido para esta API Key"
  });
}

if (!quotaApiKey) {
  return reply.status(401).send({
    error: 'API Key do Quota não encontrada'
  });
}

if (!tenantId) {
  return reply.status(401).send({
    error: 'Tenant não encontrado para essa requisição'
  });
}

    if (!SUPPORTED_PROVIDERS.some(item => item.key === quotaApiKey.provider)) {
 return reply.status(400).send({
   error:"Provider da API Key inválido"
 });
}

    const credential = await prisma.providerCredential.findUnique({
  where: {
    id: quotaApiKey.providerCredentialId
  }
});


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
    const providerPayload = { ...body };
    delete providerPayload.provider;
    delete providerPayload.requestId;
    delete providerPayload.billingGroup;
    delete providerPayload.apiKey;

    let providerResult;
    const providerStartedAt = Date.now();

try {
  providerResult = await callProvider({
  provider: credential.provider,
  apiKey: credential.apiKey,
    model,
    body: providerPayload,
    baseUrl: credential.baseUrl ?? undefined,
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
        details: error instanceof Error ? error.message : error
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
      billingGroup,
      requestId,
      success,
      statusCode,
      latencyMs: providerResult.latencyMs,
      promptTokens: providerResult.promptTokens,
      completionTokens: providerResult.completionTokens,
      totalTokens: providerResult.totalTokens,
      response: providerResult.body,
      supportedProviders: SUPPORTED_PROVIDERS.map(item => item.key)
    });
  }
}
