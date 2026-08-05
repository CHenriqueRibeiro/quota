import { PrismaClient } from "@prisma/client";
import { callProvider } from "../src/lib/provider-client";

const prisma = new PrismaClient();
const TENANT_ID = "cb8b4f8b-735d-4d60-a479-ec1a37559664";

async function main() {
  const assistant = await prisma.assistant.findFirst({
    where: { tenantId: TENANT_ID },
    include: {
      apiKey: {
        include: {
          providerCredential: true,
        },
      },
    },
  });

  if (!assistant) return console.log("Assistente não encontrado");

  const credential = assistant.apiKey?.providerCredential;
  if (!credential) return console.log("Credencial não encontrada");
  console.log("Assistente:", assistant.name, "Modelo:", assistant.model);
  console.log("systemPrompt:", JSON.stringify(assistant.systemPrompt));

  const result = await callProvider({
    provider: credential.provider as any,
    apiKey: credential.apiKey,
    model: assistant.model,
    body: {
      messages: [
        ...(assistant.systemPrompt?.trim()
          ? [{ role: "system", content: assistant.systemPrompt }]
          : []),
        { role: "user", content: "Olá, me informe o gasto do mês." },
      ],
      temperature: assistant.temperature,
      max_tokens: assistant.maxTokens,
    },
  });

  console.log("Resultado Status:", result.statusCode);
  console.log("Body:", JSON.stringify(result.body, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
