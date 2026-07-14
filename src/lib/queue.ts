import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const parsed = new URL(redisUrl);
const connectionOptions: any = {
  host: parsed.hostname,
  port: Number(parsed.port || 6379),
  password: parsed.password || undefined,
};

export const usageQueue = new Queue('usage', { connection: connectionOptions });

export async function addUsageJob(payload: any, opts?: any) {
  const jobId = payload.requestId ?? `usage_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    return usageQueue.add('usage', payload, {
    jobId,
    attempts: opts?.attempts ?? 3,
    backoff: opts?.backoff ?? { type: 'exponential', delay: 500 },
    removeOnComplete: opts?.removeOnComplete ?? { age: 3600 },
    removeOnFail: opts?.removeOnFail ?? 100,
    ...(opts ?? {})
  });
}

export default usageQueue;
