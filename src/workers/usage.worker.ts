import { Worker } from "bullmq";
import { PrismaClient, ProviderName } from "@prisma/client";
import Redis from "ioredis";

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const parsed = new URL(redisUrl);

const redis = new Redis({
  host: parsed.hostname,
  port: Number(parsed.port || 6379),
  password: parsed.password || undefined,
});

const connectionOptions = {
  host: parsed.hostname,
  port: Number(parsed.port || 6379),
  password: parsed.password || undefined,
};

const worker = new Worker(
  "usage",
  async (job) => {

    console.dir(job.data, { depth: null });

    const data = job.data as any;

    const requestId = data.requestId ?? `auto_${job.id}`;
    const tenantId = data.tenantId;
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

    const tags = data.tags ?? [];

    const promptTokens = Number(data.promptTokens ?? 0);
    const completionTokens = Number(data.completionTokens ?? 0);
    const totalTokens = Number(
      data.totalTokens ?? promptTokens + completionTokens
    );

    const estimatedCost = Number(data.estimatedCost ?? 0);

    if (!tenantId) {
      console.error("❌ tenantId não recebido");
      return;
    }

    const lockKey = `usage:processed:${requestId}`;

    const alreadyProcessed = await redis.setnx(lockKey, "1");

    if (alreadyProcessed === 0) {
      return;
    }

    await redis.expire(lockKey, 86400);

    let billingGroupId: string | null = null;

    if (billingGroupName) {
      let billingGroup = await prisma.billingGroup.findFirst({
        where: {
          tenantId,
          name: billingGroupName,
        },
      });

      if (!billingGroup) {
        billingGroup = await prisma.billingGroup.create({
          data: {
            tenantId,
            name: billingGroupName,
          },
        });
      }

      billingGroupId = billingGroup.id;
    }

    console.dir(
      {
        tenantId,
        apiKeyId,
        billingGroupId,
        provider,
        model,
        requestId,
      },
      { depth: null }
    );

    const usage = await prisma.usageLog.create({
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

        estimatedCost,

        requestId,

        success: data.success ?? true,
        statusCode: data.statusCode ?? null,
        latencyMs: data.latencyMs ?? null,
      },
    });
  },
  {
    connection: connectionOptions,
  }
);


worker.on("failed", async (job, err) => {

  if (!job) return;

  await prisma.failedUsage.create({
    data: {
      tenantId: job.data.tenantId,
      requestId: job.data.requestId,
      traceId: job.data.traceId,
      payload: job.data,
      error: err.message,
      lastAttemptAt: new Date()
    }
  });

});

process.on("SIGINT", async () => {

  await worker.close();
  await prisma.$disconnect();
  await redis.quit();

  process.exit(0);
});

export default worker;