import { addUsageJob } from '../lib/queue';

async function run() {
  const payload = {
    requestId: `test_${Date.now()}`,
    tenantId: 'test-tenant',
    billingGroup: 'test-group',
    provider: 'test-provider',
    model: 'gpt-test',
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    estimatedCostUsd: 0.0015,
    statusCode: 200,
    latencyMs: 12,
    timestamp: new Date().toISOString(),
    rawRequestBody: { test: true }
  };

  try {
    const job = await addUsageJob(payload);
  } catch (err) {
    console.error('Failed to enqueue job', err);
    process.exit(1);
  }
}

run();
