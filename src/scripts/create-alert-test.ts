import "dotenv/config";
import { prisma } from "../lib/prisma";
import { processAlerts } from "../service/alert-engine.service";


const tenantId = "dc36e5fe-01b2-43fa-a7c9-02acaec851b9";


async function main() {
  await prisma.usageLog.create({

    data: {

      tenantId,

      provider: "openai",

      model: "gpt-4",

      promptTokens: 1000,

      completionTokens: 500,

      totalTokens: 1500,

      // maior que o threshold de 0.01
      estimatedCost: 0.02,

      success: true,

      statusCode: 200,

      latencyMs: 800,

      requestId: `test-alert-${Date.now()}`,

    },

  });

  await processAlerts(tenantId);

}


main()
  .catch((error)=>{

    console.error(error);

    process.exit(1);

  })
  .finally(async()=>{

    await prisma.$disconnect();

  });