import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_ID = "cb8b4f8b-735d-4d60-a479-ec1a37559664";

async function main() {
  console.log(`=== DIAGNÓSTICO DO TENANT: ${TENANT_ID} ===\n`);

  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
  });

  if (!tenant) {
    console.log("❌ Tenant NÃO ENCONTRADO no banco de dados!");
    return;
  }
  console.log("Tenant:", tenant);

  const users = await prisma.user.findMany({
    where: { tenantId: TENANT_ID },
    include: { scope: true },
  });
  console.log("\n--- Usuários do Tenant ---");
  console.dir(users, { depth: null });

  const scopes = await prisma.scope.findMany({
    where: { tenantId: TENANT_ID },
  });
  console.log("\n--- Escopos do Tenant ---");
  console.dir(scopes, { depth: null });

  const providerCredentials = await prisma.providerCredential.findMany({
    where: { tenantId: TENANT_ID },
  });
  console.log("\n--- Credenciais de Provedor ---");
  console.dir(providerCredentials, { depth: null });

  const apiKeys = await prisma.apiKey.findMany({
    where: { tenantId: TENANT_ID },
  });
  console.log("\n--- API Keys ---");
  console.dir(apiKeys, { depth: null });

  const assistants = await prisma.assistant.findMany({
    where: { tenantId: TENANT_ID },
    include: { scope: true, apiKey: true, Topic: true },
  });
  console.log("\n--- Assistentes / Quopilotos ---");
  console.dir(assistants, { depth: null });

  const widgets = await prisma.widget.findMany({
    where: { tenantId: TENANT_ID },
    include: { assistant: true },
  });
  console.log("\n--- Widgets ---");
  console.dir(widgets, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
