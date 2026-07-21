import { prisma } from "../lib/prisma";
import { sendEmail } from "./email.service";


type TriggerAlertInput = {
  alertConfigId: string;
  title: string;
  message: string;
};


/**
 * Controla se um alerta pode ser disparado
 */
function canTriggerAlert(
  period: "REQUEST" | "DAILY" | "MONTHLY",
  lastTriggeredAt: Date | null
) {

  // Nunca disparou antes
  if (!lastTriggeredAt) {
    return true;
  }


  const now = new Date();


  switch (period) {


    // Pode disparar toda vez
    case "REQUEST":
      return true;



    // Uma vez por dia
    case "DAILY": {

      const oneDayAgo = new Date(
        now.getTime() - 24 * 60 * 60 * 1000
      );

      return lastTriggeredAt < oneDayAgo;
    }



    // Uma vez por mês
    case "MONTHLY": {

      return (
        lastTriggeredAt.getMonth() !== now.getMonth() ||
        lastTriggeredAt.getFullYear() !== now.getFullYear()
      );

    }



    default:
      return true;
  }
}



export async function triggerAlert({
  alertConfigId,
  title,
  message,
}: TriggerAlertInput) {


  const alert = await prisma.alertConfig.findUnique({
    where: {
      id: alertConfigId,
    },
  });



  if (!alert) {
    throw new Error(
      "Alert config não encontrado"
    );
  }



  /**
   * Evita disparos repetidos
   */
  const allowed = canTriggerAlert(
    alert.period,
    alert.lastTriggeredAt
  );




  /**
   * Cria histórico da notificação
   */
  const notification =
    await prisma.notification.create({

      data: {

        tenantId: alert.tenantId,

        alertConfigId: alert.id,

        title,

        message,

        channel: "EMAIL",

        status: "PENDING",

      },

    });




  try {


    /**
     * Envia email
     */
    await sendEmail({

      to: alert.email,

      subject:
        `[Quota Alert] ${title}`,

      html: `

        <div>

          <h2>${title}</h2>

          <p>${message}</p>


          <hr />

          <small>
            Alerta enviado pelo Quota
          </small>


        </div>

      `,
    });





    /**
     * Marca como enviado
     */
    await prisma.notification.update({

      where: {
        id: notification.id,
      },

      data: {

        status: "SENT",

        sentAt: new Date(),

      },

    });





    /**
     * Guarda último disparo
     */
    await prisma.alertConfig.update({

      where: {
        id: alert.id,
      },

      data: {

        lastTriggeredAt:
          new Date(),

      },

    });




    console.log(
      "Alerta enviado com sucesso"
    );



    return notification;




  } catch (error: any) {


    /**
     * Falha no envio
     */
    await prisma.notification.update({

      where: {
        id: notification.id,
      },

      data: {

        status: "FAILED",

        error:
          error.message,

      },

    });



    throw error;
  }
}