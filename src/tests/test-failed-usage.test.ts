import { expect, test } from "bun:test";
import type { ProxyResponse } from "../types/proxy";
import { PrismaClient, ProviderName } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

test("Fluxo completo Quota Proxy", async () => {

  // ------------------------------------------------------------------
  // Cria Tenant
  // ------------------------------------------------------------------

  const tenantSlug = `test-${Date.now()}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantSlug,
      slug: tenantSlug,
      plan: "STARTER"
    }
  });

  // ------------------------------------------------------------------
  // Credencial do Provider
  // ------------------------------------------------------------------

  const credential = await prisma.providerCredential.create({
    data: {
      tenantId: tenant.id,
      provider: ProviderName.openai,
      apiKey: "fake-key",
      baseUrl: "https://api.openai.com",
      isActive: true
    }
  });

  // ------------------------------------------------------------------
  // API KEY
  // ------------------------------------------------------------------

  const apiKey =
    `quota_test_${crypto.randomBytes(8).toString("hex")}`;

  const createdApiKey = await prisma.apiKey.create({
    data: {
      key: apiKey,
      name: "teste-bun",
      tenantId: tenant.id,
      provider: ProviderName.openai,
      providerCredentialId: credential.id
    }
  });

  // ------------------------------------------------------------------
  // Chama Proxy
  // ------------------------------------------------------------------

  const response = await fetch(
    "http://localhost:3000/proxy",
    {
      method: "POST",

      headers: {
        "content-type": "application/json",

        "x-api-key": apiKey,

        "x-billing-group": "financeiro",
        "x-agent": "bot-atendimento",
        "x-project": "central-ia",
        "x-environment": "production",
        "x-user-id": "cliente-12345",
        "x-request-group": "suporte-whatsapp",
        "x-trace-id": "trace-test-001",
        "x-tags": "vip,cliente-antigo"
      },

      body: JSON.stringify({
        model: "gpt-test",
        messages: [
          {
            role: "user",
            content: "Teste Quota"
          }
        ]
      })
    }
  );

  expect(response.status).toBeDefined();

const body = await response.json() as ProxyResponse;

  console.log("\n===== RESPOSTA DO PROXY =====");
  console.log(body);

  // ------------------------------------------------------------------
  // Espera Worker Persistir
  // ------------------------------------------------------------------

  await Bun.sleep(2000);

  // ------------------------------------------------------------------
  // Busca Usage Log
  // ------------------------------------------------------------------

  const usages = await prisma.usageLog.findMany({
  orderBy: {
    createdAt: "desc"
  },
  take: 10
});

console.log("\n===== ÚLTIMOS USAGE LOGS =====");
console.dir(usages, { depth: null });

const usage = usages.find(u => u.tenantId === tenant.id);

console.log("\n===== USAGE DO TENANT =====");
console.dir(usage, { depth: null });

  // ------------------------------------------------------------------
  // Validações
  // ------------------------------------------------------------------

  expect(usage).not.toBeNull();

  expect(usage?.tenantId).toBe(tenant.id);

  expect(usage?.billingGroupId).toBeDefined();

  expect(usage?.provider).toBe("openai");

  expect(usage?.model).toBe("gpt-test");

  expect(usage?.traceId).toBe("trace-test-001");

  expect(usage?.agent).toBe("bot-atendimento");

  expect(usage?.project).toBe("central-ia");

  expect(usage?.environment).toBe("production");

  expect(usage?.externalUserId).toBe("cliente-12345");

  expect(usage?.requestGroup).toBe("suporte-whatsapp");

  expect(usage?.apiKeyId).toBe(createdApiKey.id);

  expect(usage?.requestId).toBe(body.requestId);

  console.log("\n===== API KEY ESPERADA =====");
  console.log(createdApiKey.id);

  console.log("\n===== API KEY SALVA =====");
  console.log(usage?.apiKeyId);

  await prisma.$disconnect();

});