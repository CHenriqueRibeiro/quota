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



/**
 * Verifica se a hora atual está dentro do intervalo silencioso configurado no alerta.
 */
export function isWithinQuietHours(alert: {
  quietHoursEnabled?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string | null;
}): boolean {
  if (!alert.quietHoursEnabled || !alert.quietHoursStart || !alert.quietHoursEnd) {
    return false;
  }

  try {
    const tz = alert.timezone || "America/Sao_Paulo";
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    const parts = formatter.formatToParts(now);
    const hourStr = parts.find((p) => p.type === "hour")?.value || "00";
    const minuteStr = parts.find((p) => p.type === "minute")?.value || "00";

    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

    const [startH, startM] = alert.quietHoursStart.split(":").map((v) => parseInt(v, 10));
    const [endH, endM] = alert.quietHoursEnd.split(":").map((v) => parseInt(v, 10));

    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    if (startMinutes === endMinutes) {
      return false;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  } catch (error) {
    console.error("Erro ao verificar quiet hours:", error);
    return false;
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
    throw new Error("Alert config não encontrado");
  }

  /**
   * Evita disparos repetidos
   */
  const allowed = canTriggerAlert(
    alert.period,
    alert.lastTriggeredAt
  );

  if (!allowed) {
    return null;
  }

  /**
   * Verifica se o disparo ocorreu durante a janela de silêncio (quiet hours)
   */
  if (isWithinQuietHours(alert)) {
    // EXTENSION POINT (Fila / Agendamento Futuro):
    // Se no futuro for necessário adiar o envio em vez de mutar,
    // o status pode ser alterado para "QUEUED" e uma tarefa agendada para o término da janela.
    const mutedNotification = await prisma.notification.create({
      data: {
        tenantId: alert.tenantId,
        alertConfigId: alert.id,
        title,
        message: `${message} (Silenciado devido à configuração de horário de silêncio ${alert.quietHoursStart} - ${alert.quietHoursEnd})`,
        channel: "EMAIL",
        status: "MUTED",
      },
    });

    await prisma.alertConfig.update({
      where: { id: alert.id },
      data: { lastTriggeredAt: new Date() },
    });

    console.log("Alerta registrado como MUTED (janela de silêncio ativa)");
    return mutedNotification;
  }

  /**
   * Cria histórico da notificação
   */
  const notification = await prisma.notification.create({
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
     * Envia email (incluindo CC caso configurado)
     */
    await sendEmail({
      to: alert.email,
      cc: alert.ccEmails && alert.ccEmails.length > 0 ? alert.ccEmails : undefined,
      subject: `[Quota Alert] ${title}`,
      html: `
        <div>
          <h2>${title}</h2>
          <p>${message}</p>
          <hr />
          <small>Alerta enviado pelo Quota</small>
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
        lastTriggeredAt: new Date(),
      },
    });

    console.log("Alerta enviado com sucesso");

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
        error: error.message,
      },
    });

    throw error;
  }
}