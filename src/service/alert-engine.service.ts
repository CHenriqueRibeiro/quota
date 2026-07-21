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

}