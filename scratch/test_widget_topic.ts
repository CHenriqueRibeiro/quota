import { PrismaClient } from "@prisma/client";
import widgetService from "../src/service/widget.service";
import widgetTopicService from "../src/service/widget-topic.service";

const prisma = new PrismaClient();

async function main() {
  const widget = await prisma.widget.findFirst({
    include: {
      assistant: {
        include: {
          Topic: true,
        },
      },
    },
  });

  if (!widget) return console.log("Nenhum widget encontrado.");

  const initData = await widgetService.initWidget({
    publicKey: widget.publicKey,
    origin: "http://localhost:5173",
  });

  console.log("Sessão criada:", initData.sessionToken);
  console.log("Tópicos do widget:", initData.topics.map((t) => ({ id: t.id, name: t.name })));

  const firstTopic = initData.topics[0];
  if (!firstTopic) return console.log("Nenhum tópico cadastrado no assistente.");

  console.log(`\nTestando seleção do tópico "${firstTopic.name}" (ID: ${firstTopic.id})...`);
  try {
    const result = await widgetTopicService.execute({
      sessionToken: initData.sessionToken,
      topicId: firstTopic.id,
    });
    console.log("[OK] Execução do tópico bem-sucedida!");
    console.log("Resultado:", JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("[ERRO] Falha ao executar tópico:", err.message, err);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
