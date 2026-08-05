import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_ID = "cb8b4f8b-735d-4d60-a479-ec1a37559664";

async function main() {
  console.log("Corrigindo modelo do assistente...");

  const updated = await prisma.assistant.updateMany({
    where: {
      tenantId: TENANT_ID,
      model: "gpt-4.1",
    },
    data: {
      model: "gpt-4o-mini",
    },
  });

  console.log("Assistentes atualizados:", updated);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
