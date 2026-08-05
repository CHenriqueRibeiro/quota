import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const widgets = await prisma.widget.findMany({
    include: {
      assistant: {
        include: {
          Topic: true,
          apiKey: {
            include: {
              providerCredential: true,
            },
          },
        },
      },
    },
  });

  console.log(`Total de widgets encontrados: ${widgets.length}`);
  for (const w of widgets) {
    console.log(`\n--- Widget: ${w.name} (ID: ${w.id}) ---`);
    console.log("Public Key:", w.publicKey);
    console.log("Allowed Domains:", w.allowedDomains);
    console.log("Assistente:", w.assistant?.name);
    console.log("Modelo assistente:", w.assistant?.model);
    console.log("API Key vinculada:", w.assistant?.apiKey ? "SIM" : "NÃO");
    console.log("Provider Credential:", w.assistant?.apiKey?.providerCredential ? "SIM" : "NÃO");
    console.log("Tópicos cadastrados:", w.assistant?.Topic.length || 0);
    w.assistant?.Topic.forEach((t) => console.log(`  - [${t.id}] ${t.name}: ${t.description}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
