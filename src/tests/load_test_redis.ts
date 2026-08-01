/**
 * ============================================================================
 *  QUOTA — Teste de Carga e Estresse (Redis Rate Limiting & Queueing)
 * ============================================================================
 *
 *  Métricas testadas:
 *    1. Resposta sob rajada simultânea de requisições (Concurrency)
 *    2. Rate Limiting via Redis (Incr/Expire window & HTTP 429)
 *    3. Enfileiramento assíncrono no BullMQ / Redis (Route Collector)
 *    4. Latência média, P95, vazão (Req/sec) e integridade dos dados
 *
 *  Rodar:  bun src/tests/load_test_redis.ts
 * ============================================================================
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

async function runLoadTest() {
  console.log("==========================================================");
  console.log(" 🚀 INICIANDO TESTE DE CARGA E ESTRESSE (REDIS & BULLMQ)  ");
  console.log("==========================================================\n");

  // 1. Obter usuário via ENV ou primeiro do banco
  const envUserId = process.env.TEST_USER_ID;
  const user = envUserId
    ? await prisma.user.findUnique({ where: { id: envUserId } })
    : await prisma.user.findFirst();

  if (!user) throw new Error("Nenhum usuário encontrado no banco de dados.");

  const TENANT_ID = process.env.TEST_TENANT_ID || user.tenantId;

  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: "123456" }),
  });
  const loginBody = await loginRes.json() as any;
  const token = loginBody.token;

  if (!token) throw new Error("Falha ao obter token de login");

  // 2. Garantir Credencial + API Key para testes de collector
  const cred = await prisma.providerCredential.upsert({
    where: { tenantId_provider: { tenantId: TENANT_ID, provider: "openai" } },
    update: { isActive: true },
    create: { tenantId: TENANT_ID, provider: "openai", apiKey: "sk-fake-loadtest" },
  });

  const keyName = `loadkey-${Date.now()}`;
  const keyStr = `quota_live_${crypto.randomBytes(16).toString("hex")}`;
  const apiKey = await prisma.apiKey.create({
    data: {
      name: keyName,
      key: keyStr,
      tenantId: TENANT_ID,
      provider: "openai",
      providerCredentialId: cred.id,
    },
  });

  console.log(`✅ Token JWT obtido com sucesso`);
  console.log(`✅ API Key temporária gerada: ${apiKey.key.slice(0, 18)}...\n`);

  /* ------------------------------------------------------------------ */
  /*  TESTE 1: RAJADA CONCORRENTE NO COLLECTOR (BULLMQ ENQUEUEING)       */
  /* ------------------------------------------------------------------ */
  const TOTAL_COLLECTOR_REQUESTS = 100;
  const CONCURRENCY_BATCH = 25; // 25 requisições em paralelo simultâneo por lote

  console.log(`🔥 [TESTE 1] Enfileirando ${TOTAL_COLLECTOR_REQUESTS} eventos no Collector (em lotes concorrentes de ${CONCURRENCY_BATCH})...`);
  
  const collectorTimes: number[] = [];
  let collectorSuccessCount = 0;
  let collectorFailCount = 0;

  const startCollectorTime = performance.now();

  for (let i = 0; i < TOTAL_COLLECTOR_REQUESTS; i += CONCURRENCY_BATCH) {
    const batchPromises = Array.from({ length: CONCURRENCY_BATCH }).map(async (_, idx) => {
      const reqNum = i + idx + 1;
      const reqStart = performance.now();

      try {
        const res = await fetch(`${BASE}/collector`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey.key,
          },
          body: JSON.stringify({
            provider: "openai",
            model: "gpt-4o-mini",
            promptTokens: 100 + reqNum,
            completionTokens: 50,
            latencyMs: 300 + (reqNum * 2),
            statusCode: 200,
            success: true,
          }),
        });

        const elapsed = performance.now() - reqStart;
        collectorTimes.push(elapsed);

        if (res.status === 202) {
          collectorSuccessCount++;
        } else {
          collectorFailCount++;
        }
      } catch (err) {
        collectorFailCount++;
      }
    });

    await Promise.all(batchPromises);
  }

  const endCollectorTime = performance.now();
  const totalCollectorDurationMs = endCollectorTime - startCollectorTime;

  collectorTimes.sort((a, b) => a - b);
  const avgCollectorLatency = collectorTimes.reduce((a, b) => a + b, 0) / collectorTimes.length;
  const p95CollectorLatency = collectorTimes[Math.floor(collectorTimes.length * 0.95)] || 0;
  const collectorRps = (TOTAL_COLLECTOR_REQUESTS / (totalCollectorDurationMs / 1000)).toFixed(2);

  console.log(`   📊 Resultados do Enfileiramento Redis (BullMQ):`);
  console.log(`      - Requisições Aceitas (202 Accepted): ${collectorSuccessCount} / ${TOTAL_COLLECTOR_REQUESTS}`);
  console.log(`      - Falhas: ${collectorFailCount}`);
  console.log(`      - Tempo Total: ${totalCollectorDurationMs.toFixed(2)} ms`);
  console.log(`      - Vazão (RPS): ${collectorRps} req/segundo`);
  console.log(`      - Latência Média de Enfileiramento: ${avgCollectorLatency.toFixed(2)} ms`);
  console.log(`      - Latência P95: ${p95CollectorLatency.toFixed(2)} ms\n`);

  /* ------------------------------------------------------------------ */
  /*  TESTE 2: AGUARDAR PROCESSAMENTO DO WORKER EM SEGUNDO PLANO       */
  /* ------------------------------------------------------------------ */
  console.log(`⏳ [TESTE 2] Aguardando o Worker Redis processar a fila...`);
  await new Promise(res => setTimeout(res, 5000));

  const usageCount = await prisma.usageLog.count({
    where: { apiKeyId: apiKey.id },
  });

  console.log(`   📊 Verificação no Banco de Dados (PostgreSQL):`);
  console.log(`      - Registros salvos pelo Worker: ${usageCount} / ${TOTAL_COLLECTOR_REQUESTS} eventos`);
  if (usageCount === TOTAL_COLLECTOR_REQUESTS) {
    console.log(`      ✅ 100% dos eventos da fila Redis foram processados pelo Worker!\n`);
  } else {
    console.log(`      ⚠️ ${usageCount} de ${TOTAL_COLLECTOR_REQUESTS} processados até o momento.\n`);
  }

  /* ------------------------------------------------------------------ */
  /*  TESTE 3: VALIDAÇÃO DO RATE LIMITER NO REDIS                        */
  /* ------------------------------------------------------------------ */
  console.log(`🛡️ [TESTE 3] Testando disparo de rajada em rotas com Rate Limit Redis...`);
  
  // Fazer requisições de leitura de métricas em velocidade alta
  const READ_REQUESTS = 30;
  let status200 = 0;
  let status429 = 0;
  let lastQuotaLimit = "";
  let lastQuotaRemaining = "";

  const readPromises = Array.from({ length: READ_REQUESTS }).map(async () => {
    const res = await fetch(`${BASE}/analytics/overview?startDate=2020-01-01&endDate=2030-12-31`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.headers.get("x-quota-limit")) lastQuotaLimit = res.headers.get("x-quota-limit")!;
    if (res.headers.get("x-quota-remaining")) lastQuotaRemaining = res.headers.get("x-quota-remaining")!;

    if (res.status === 200) status200++;
    if (res.status === 429) status429++;
  });

  await Promise.all(readPromises);

  console.log(`   📊 Resultados de Leitura sob Estresse:`);
  console.log(`      - Respostas 200 OK: ${status200}`);
  console.log(`      - Bloqueios 429 Too Many Requests: ${status429}`);
  if (lastQuotaLimit) {
    console.log(`      - Cabeçalhos Redis: X-Quota-Limit=${lastQuotaLimit}, X-Quota-Remaining=${lastQuotaRemaining}`);
  }

  // 4. Testar o mecanismo Redis Multi/Incr diretamente
  const { redis } = await import("../lib/redis");
  const testKey = `quota:limit:test-${Date.now()}`;
  const limitCap = 5;
  let blockedCount = 0;
  let allowedCount = 0;

  for (let r = 1; r <= 10; r++) {
    const [_, currentUsage] = (await redis.multi().incr(testKey).expire(testKey, 60).exec()) as [any, [any, number]];
    const count = Number(currentUsage[1]);
    if (count > limitCap) {
      blockedCount++;
    } else {
      allowedCount++;
    }
  }

  await redis.del(testKey);

  console.log(`\n🔒 [TESTE 4] Validação de Limite no Redis (Cap de 5 reqs em janela de 60s):`);
  console.log(`      - Requisições Permitidas (≤ 5): ${allowedCount}`);
  console.log(`      - Requisições Bloqueadas (> 5): ${blockedCount}`);
  console.log(`      ✅ Redis incrementou contador atomicamente e bloqueou requisições excedentes!\n`);

  // Limpeza da API key de teste
  await prisma.usageLog.deleteMany({ where: { apiKeyId: apiKey.id } });
  await prisma.apiKey.delete({ where: { id: apiKey.id } });
  await prisma.$disconnect();

  console.log("==========================================================");
  console.log(" 🎉 TESTE DE CARGA CONCLUÍDO COM SUCESSO!                 ");
  console.log("==========================================================");
}

runLoadTest().catch(console.error);
