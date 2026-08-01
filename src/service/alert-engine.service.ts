import { prisma } from "../lib/prisma";
import { triggerAlert } from "./alert.service";


function getPeriodDate(
  period: "REQUEST" | "DAILY" | "MONTHLY"
) {

  const now = new Date();


  switch (period) {

    case "DAILY":
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );


    case "MONTHLY":
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );


    case "REQUEST":
      return new Date(0);


    default:
      return new Date(0);
  }
}




async function checkCostAlert(alert: any) {


  const result =
    await prisma.usageLog.aggregate({

      where: {

        tenantId: alert.tenantId,

        createdAt: {
          gte: getPeriodDate(alert.period)
        }

      },


      _sum: {

        estimatedCost: true

      }

    });



  const cost =
    result._sum.estimatedCost ?? 0;



  if (cost >= alert.threshold) {


    await triggerAlert({

      alertConfigId: alert.id,

      title:
        "Limite de custo atingido",


      message:
        `Seu consumo atual é $${cost.toFixed(2)} e ultrapassou o limite configurado de $${alert.threshold}.`

    });

  }

}





async function checkTokenAlert(alert: any) {


  const result =
    await prisma.usageLog.aggregate({

      where: {

        tenantId: alert.tenantId,

        createdAt: {
          gte: getPeriodDate(alert.period)
        }

      },


      _sum: {

        totalTokens: true

      }

    });



  const tokens =
    result._sum.totalTokens ?? 0;



  if (tokens >= alert.threshold) {


    await triggerAlert({

      alertConfigId: alert.id,

      title:
        "Limite de tokens atingido",


      message:
        `Seu consumo atual é ${tokens} tokens e ultrapassou o limite configurado de ${alert.threshold}.`

    });

  }

}





async function checkErrorAlert(alert: any) {


  const errors =
    await prisma.usageLog.count({

      where: {

        tenantId: alert.tenantId,

        success:false,

        createdAt:{
          gte:getPeriodDate(alert.period)
        }

      }

    });



  if(errors >= alert.threshold){


    await triggerAlert({

      alertConfigId: alert.id,

      title:
        "Quantidade de erros elevada",


      message:
        `Foram encontrados ${errors} erros no período configurado.`

    });

  }

}





async function checkLatencyAlert(alert: any) {


  const result =
    await prisma.usageLog.aggregate({

      where:{
        tenantId: alert.tenantId,

        createdAt:{
          gte:getPeriodDate(alert.period)
        }
      },


      _avg:{
        latencyMs:true
      }

    });



  const latency =
    result._avg.latencyMs ?? 0;



  if(latency >= alert.threshold){


    await triggerAlert({

      alertConfigId: alert.id,

      title:
        "Latência elevada",


      message:
        `A latência média está em ${latency.toFixed(0)}ms.`

    });

  }

}





async function checkBudgets(tenantId: string) {
  const budgets = await prisma.budget.findMany({
    where: { tenantId }
  });

  if (!budgets || budgets.length === 0) return;

  const costAlerts = await prisma.alertConfig.findMany({
    where: { tenantId, type: "COST", enabled: true }
  });

  for (const budget of budgets) {
    const startDate = getPeriodDate(budget.period as any);
    const where: any = {
      tenantId,
      createdAt: { gte: startDate }
    };

    if (budget.billingGroupId) where.billingGroupId = budget.billingGroupId;
    if (budget.project) where.project = budget.project;
    if (budget.agent) where.agent = budget.agent;

    const result = await prisma.usageLog.aggregate({
      where,
      _sum: { estimatedCost: true }
    });

    const cost = Number(result._sum.estimatedCost ?? 0);
    const limit = Number(budget.limit);
    const targetName = budget.project
      ? `Projeto ${budget.project}`
      : budget.agent
      ? `Agente ${budget.agent}`
      : "Global";

    if (limit > 0 && cost >= limit) {
      const targetAlert = costAlerts[0];
      if (targetAlert) {
        await triggerAlert({
          alertConfigId: targetAlert.id,
          title: `Orçamento Estourado (${targetName})`,
          message: `O consumo de $${cost.toFixed(2)} ultrapassou o orçamento limite de $${limit.toFixed(2)}.`
        });
      }
    } else if (limit > 0 && cost >= limit * 0.8) {
      const targetAlert = costAlerts[0];
      if (targetAlert) {
        await triggerAlert({
          alertConfigId: targetAlert.id,
          title: `Alerta de Orçamento 80% (${targetName})`,
          message: `O consumo de $${cost.toFixed(2)} atingiu 80% do orçamento limite de $${limit.toFixed(2)}.`
        });
      }
    }
  }
}

export async function processAlerts(
  tenantId:string
) {


  const alerts =
    await prisma.alertConfig.findMany({

      where:{
        tenantId,

        enabled:true
      }

    });



  for(const alert of alerts){


    switch(alert.type){


      case "COST":

        await checkCostAlert(alert);

        break;



      case "TOKENS":

        await checkTokenAlert(alert);

        break;



      case "ERRORS":

        await checkErrorAlert(alert);

        break;



      case "LATENCY":

        await checkLatencyAlert(alert);

        break;

    }

  }

  await checkBudgets(tenantId);

}