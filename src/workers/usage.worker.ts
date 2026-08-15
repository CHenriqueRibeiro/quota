import { Worker } from "bullmq";
import { ProviderName } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { connectionOptions } from "../lib/queue";
import { processAlerts } from "../service/alert-engine.service";
import llmPricingService from "../service/llm-pricing.service";

// Cache em memoria para BillingGroups frequentes
const billingGroupMemoryCache = new Map<string, string>();

async function resolveBillingGroupId(tenantId: string, billingGroupName?: string): Promise<string | null> {
  if (!billingGroupName) return null;
  const cacheKey = `${tenantId}:${billingGroupName}`;
  
  if (billingGroupMemoryCache.has(cacheKey)) {
    return billingGroupMemoryCache.get(cacheKey) || null;
  }

  const redisKey = `billing_group:${tenantId}:${billingGroupName}`;
  const cachedRedisId = await redis.get(redisKey);
  if (cachedRedisId) {
    billingGroupMemoryCache.set(cacheKey, cachedRedisId);
    return cachedRedisId;
  }

  let billingGroup = await prisma.billingGroup.findFirst({
    where: {
      tenantId,
      name: billingGroupName,
    },
    select: { id: true },
  });

  if (!billingGroup) {
    try {
      billingGroup = await prisma.billingGroup.create({
        data: {
          tenantId,
          name: billingGroupName,
        },
        select: { id: true },
      });
    } catch {
      billingGroup = await prisma.billingGroup.findFirst({
        where: { tenantId, name: billingGroupName },
        select: { id: true },
      });
    }
  }

  if (billingGroup?.id) {
    billingGroupMemoryCache.set(cacheKey, billingGroup.id);
    await redis.set(redisKey, billingGroup.id, "EX", 3600);
    return billingGroup.id;
  }

  return null;
}

const worker = new Worker(
  "usage",
  async (job) => {
    const data = job.data as any;

    const requestId = data.requestId ?? `auto_${job.id}`;
    const tenantId = data.tenantId;
    if (!tenantId) {
      console.error("[UsageWorker] tenantId nao recebido");
      return;
    }

    const apiKeyId = data.apiKeyId ?? null;
    const billingGroupName = data.billingGroup;
    const provider = data.provider as ProviderName;
    const model = data.model ?? "unknown";

    const traceId = data.traceId;
    const agent = data.agent;
    const project = data.project;
    const environment = data.environment;
    const externalUserId = data.externalUserId;
    const requestGroup = data.requestGroup;

    // Sanitizacao e validacao das tags
    const rawTags = Array.isArray(data.tags) ? data.tags : [];
    const tags = rawTags
      .filter((t: any) => typeof t === "string" && t.trim().length > 0)
      .map((t: string) => t.trim().slice(0, 50))
      .slice(0, 20);

    const promptTokens = Math.max(0, Number(data.promptTokens ?? 0));
    const completionTokens = Math.max(0, Number(data.completionTokens ?? 0));
    const cachedTokens = Math.max(0, Number(data.cachedTokens ?? 0));
    const reasoningTokens = Math.max(0, Number(data.reasoningTokens ?? 0));
    const cacheCreationTokens = Math.max(0, Number(data.cacheCreationTokens ?? 0));
    const totalTokens = Math.max(0, Number(data.totalTokens ?? promptTokens + completionTokens));

    let estimatedCost = Number(data.estimatedCost ?? 0);
    if (estimatedCost <= 0 && (promptTokens > 0 || completionTokens > 0)) {
      estimatedCost = llmPricingService.calculateCost({
        provider,
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
      });
    }

    // Idempotencia / Deduplicacao via Redis NX
    const lockKey = `usage:processed:${requestId}`;
    const acquired = await redis.set(lockKey, "1", "EX", 86400, "NX");
    if (!acquired) {
      return;
    }

    // Resolucao otimizada com cache de billing group
    const billingGroupId = await resolveBillingGroupId(tenantId, billingGroupName);

    // Insercao no banco de dados com campos tipados e higienizados
    await prisma.usageLog.create({
      data: {
        tenantId,
        billingGroupId,
        apiKeyId,
        traceId,
        agent,
        project,
        environment,
        externalUserId,
        requestGroup,
        tags,
        provider,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        cachedTokens,
        reasoningTokens,
        cacheCreationTokens,
        estimatedCost,
        requestId,
        success: data.success ?? true,
        statusCode: data.statusCode ? Number(data.statusCode) : null,
        latencyMs: data.latencyMs ? Number(data.latencyMs) : null,
      },
    });

    // Atualiza contador de uso mensal no Redis para checagem rapida no Proxy
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const monthlyKey = `quota:monthly_count:${tenantId}:${monthStr}`;
      await redis.incr(monthlyKey);
    } catch {
      // Nao bloqueia caso Redis tenha instabilidade pontual
    }

    // Debounce na checagem de alertas: avalia no maximo uma vez a cada 30 segundos por tenant
    try {
      const alertThrottleKey = `alert:throttle:${tenantId}`;
      const canRunAlerts = await redis.set(alertThrottleKey, "1", "EX", 30, "NX");
      if (canRunAlerts) {
        await processAlerts(tenantId);
      }
    } catch (error) {
      console.error("[UsageWorker] Erro ao processar alertas:", error);
    }
  },
  {
    connection: connectionOptions,
    concurrency: 5,
  }
);

worker.on("failed", async (job, err) => {
  if (!job) return;
  const data = job.data as any;

  let billingGroupId: string | null = null;
  if (data.billingGroup && data.tenantId) {
    try {
      billingGroupId = await resolveBillingGroupId(data.tenantId, data.billingGroup);
    } catch {
      // fallback silencioso
    }
  }

  await prisma.failedUsage.create({
    data: {
      tenantId: data.tenantId,
      requestId: data.requestId ?? `failed_${job.id}`,
      traceId: data.traceId ?? null,
      billingGroupId,
      provider: data.provider ?? null,
      model: data.model ?? null,
      project: data.project ?? null,
      agent: data.agent ?? null,
      payload: data,
      error: err.message,
      lastAttemptAt: new Date(),
    },
  });
});

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

export default worker;
