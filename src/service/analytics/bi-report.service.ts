import { prisma } from '../../lib/prisma';
import { randomBytes } from 'crypto';
import { sendEmail } from '../email.service';

export class BIReportService {
  /**
   * Lista todos os relatórios BI salvos para um determinado tenant.
   */
  public async listReports(tenantId: string) {
    return prisma.biReport.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Obtém um relatório BI por ID (com validação de tenantId).
   */
  public async getReportById(tenantId: string, id: string) {
    return prisma.biReport.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Salva ou atualiza uma visão de BI (cria nova se não houver ID informado).
   */
  public async saveReport(
    tenantId: string,
    data: {
      id?: string;
      title?: string;
      description?: string;
      isDefault?: boolean;
      tabsConfig: any;
      customFields?: any;
    }
  ) {
    if (data.isDefault) {
      await prisma.biReport.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    if (data.id) {
      const existing = await prisma.biReport.findFirst({
        where: { id: data.id, tenantId },
      });

      if (existing) {
        return prisma.biReport.update({
          where: { id: data.id },
          data: {
            title: data.title ?? existing.title,
            description: data.description ?? existing.description,
            isDefault: data.isDefault ?? existing.isDefault,
            tabsConfig: data.tabsConfig ?? existing.tabsConfig,
            customFields: data.customFields ?? existing.customFields,
          },
        });
      }
    }

    return prisma.biReport.create({
      data: {
        tenantId,
        title: data.title || 'Dashboard BI Personalizado',
        description: data.description || '',
        isDefault: data.isDefault || false,
        tabsConfig: data.tabsConfig,
        customFields: data.customFields || [],
        shareToken: `bi_${randomBytes(16).toString('hex')}`,
      },
    });
  }

  /**
   * Exclui um relatório BI salvo por ID.
   */
  public async deleteReport(tenantId: string, id: string) {
    const existing = await prisma.biReport.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Relatório BI não encontrado.');
    }

    return prisma.biReport.delete({
      where: { id },
    });
  }

  /**
   * Gera ou atualiza o link público seguro e define a validade (expiração por data/horário).
   */
  public async shareReport(
    tenantId: string,
    id: string,
    data: {
      publicExpiresAt?: string | null;
      isPublic?: boolean;
    }
  ) {
    const report = await prisma.biReport.findFirst({
      where: { id, tenantId },
    });

    if (!report) {
      throw new Error('Relatório BI não encontrado.');
    }

    let token = report.shareToken;
    if (!token) {
      token = `bi_${randomBytes(16).toString('hex')}`;
    }

    const expiresAt = data.publicExpiresAt ? new Date(data.publicExpiresAt) : null;

    return prisma.biReport.update({
      where: { id },
      data: {
        shareToken: token,
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
        publicExpiresAt: expiresAt,
        isRevoked: false, // Reativa o relatório caso estivesse revogado
      },
    });
  }

  /**
   * REVOGAÇÃO IMEDIATA DO LINK PÚBLICO
   * Invalida o token público para que o link deixe de funcionar imediatamente!
   */
  public async revokeShare(tenantId: string, id: string) {
    const report = await prisma.biReport.findFirst({
      where: { id, tenantId },
    });

    if (!report) {
      throw new Error('Relatório BI não encontrado.');
    }

    return prisma.biReport.update({
      where: { id },
      data: {
        isPublic: false,
        isRevoked: true,
      },
    });
  }

  /**
   * Configura o agendamento de envio automático por e-mail com cópias (CC).
   */
  public async updateSchedule(
    tenantId: string,
    id: string,
    data: {
      scheduleEnabled: boolean;
      scheduleEmail?: string;
      scheduleCc?: string[];
      scheduleFrequency?: string;
      scheduleDayOfWeek?: number;
      scheduleDayOfMonth?: number;
      scheduleTime?: string;
    }
  ) {
    const report = await prisma.biReport.findFirst({
      where: { id, tenantId },
    });

    if (!report) {
      throw new Error('Relatório BI não encontrado.');
    }

    // Garante que existe um shareToken para o link público no e-mail
    let token = report.shareToken;
    if (!token) {
      token = `bi_${randomBytes(16).toString('hex')}`;
    }

    return prisma.biReport.update({
      where: { id },
      data: {
        shareToken: token,
        isPublic: data.scheduleEnabled ? true : report.isPublic,
        scheduleEnabled: data.scheduleEnabled,
        scheduleEmail: data.scheduleEmail || report.scheduleEmail,
        scheduleCc: data.scheduleCc !== undefined ? data.scheduleCc : report.scheduleCc,
        scheduleFrequency: data.scheduleFrequency || report.scheduleFrequency,
        scheduleDayOfWeek: data.scheduleDayOfWeek ?? report.scheduleDayOfWeek,
        scheduleDayOfMonth: data.scheduleDayOfMonth ?? report.scheduleDayOfMonth,
        scheduleTime: data.scheduleTime || report.scheduleTime,
      },
    });
  }

  /**
   * CONSULTA PÚBLICA (SEM AUTENTICAÇÃO)
   * Valida se a chave pública está ativa, dentro do prazo e NÃO revogada.
   */
  public async getReportByShareToken(shareToken: string) {
    const report = await prisma.biReport.findUnique({
      where: { shareToken },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!report) {
      return { status: 'NOT_FOUND', report: null };
    }

    if (report.isRevoked || !report.isPublic) {
      return { status: 'REVOKED', report: null };
    }

    if (report.publicExpiresAt && new Date(report.publicExpiresAt) < new Date()) {
      return { status: 'EXPIRED', report: null };
    }

    return { status: 'VALID', report };
  }

  /**
   * Processa todos os agendamentos ativos de Relatórios BI (BiReport).
   * Chamado periodicamente pelo worker de agendamentos.
   */
  public async processDueBiReportSchedules() {
    const now = new Date();

    // Obtém o horário atual no fuso horário do Brasil (America/Fortaleza / UTC-3)
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Fortaleza",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    let hour = "00", minute = "00";
    for (const p of timeParts) {
      if (p.type === "hour") hour = p.value.padStart(2, "0");
      if (p.type === "minute") minute = p.value.padStart(2, "0");
    }
    if (hour === "24") hour = "00";
    const currentHHmm = `${hour}:${minute}`;

    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(now);

    let year = "", month = "", day = "";
    for (const p of dateParts) {
      if (p.type === "year") year = p.value;
      if (p.type === "month") month = p.value.padStart(2, "0");
      if (p.type === "day") day = p.value.padStart(2, "0");
    }
    const brtDateStr = `${year}-${month}-${day}`;

    // Obtém dia da semana no fuso BRT
    const brtDateObj = new Date(`${brtDateStr}T12:00:00-03:00`);
    const currentDayOfWeek = brtDateObj.getDay(); // 0 (Dom) - 6 (Sáb)
    const currentDayOfMonth = Number(day); // 1 - 31

    const reports = await prisma.biReport.findMany({
      where: {
        scheduleEnabled: true,
        scheduleEmail: { not: null },
        isRevoked: false,
      },
      include: {
        tenant: true,
      },
    });

    if (!reports || reports.length === 0) return;

    for (const report of reports) {
      try {
        if (!report.scheduleEmail) continue;

        const scheduleTime = report.scheduleTime || "08:00";

        // Checa se já foi enviado HOJE no horário agendado ou depois
        if (report.lastSentAt) {
          const lastSent = new Date(report.lastSentAt);
          const lsParts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Fortaleza",
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(lastSent);

          let lsY = "", lsM = "", lsD = "", lsH = "00", lsMin = "00";
          for (const p of lsParts) {
            if (p.type === "year") lsY = p.value;
            if (p.type === "month") lsM = p.value.padStart(2, "0");
            if (p.type === "day") lsD = p.value.padStart(2, "0");
            if (p.type === "hour") lsH = p.value.padStart(2, "0");
            if (p.type === "minute") lsMin = p.value.padStart(2, "0");
          }
          if (lsH === "24") lsH = "00";
          const lastSentDateStr = `${lsY}-${lsM}-${lsD}`;
          const lastSentHHmm = `${lsH}:${lsMin}`;

          const isSameDay = lastSentDateStr === brtDateStr;

          if (isSameDay && lastSentHHmm >= scheduleTime) {
            continue; // Já foi enviado hoje no horário ou depois
          }
        }

        // Verifica se o horário atual já atingiu ou passou do horário configurado
        if (currentHHmm < scheduleTime) {
          continue; // Ainda não deu o horário de envio de hoje
        }

        let isDue = false;
        const freq = (report.scheduleFrequency || "DAILY").toUpperCase();

        if (freq === "DAILY") {
          isDue = true;
        } else if (freq === "WEEKLY") {
          isDue = report.scheduleDayOfWeek === null || report.scheduleDayOfWeek === undefined || currentDayOfWeek === Number(report.scheduleDayOfWeek);
        } else if (freq === "MONTHLY") {
          isDue = report.scheduleDayOfMonth === null || report.scheduleDayOfMonth === undefined || currentDayOfMonth === Number(report.scheduleDayOfMonth);
        }

        if (isDue) {
          console.log(`[BI Reports Worker] 📧 Disparando agendamento do relatório BI "${report.title}" para ${report.scheduleEmail} (Horário Configurado: ${scheduleTime}, Atual BRT: ${currentHHmm})...`);

          const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
          const publicUrl = report.shareToken
            ? `${baseUrl}/public/bi-report/${report.shareToken}`
            : null;

          // Registra a notificação no histórico
          const notification = await prisma.notification.create({
            data: {
              tenantId: report.tenantId,
              title: `Relatório BI Agendado: ${report.title}`,
              message: `Disparo do relatório BI "${report.title}" para ${report.scheduleEmail}.`,
              channel: "EMAIL",
              status: "PENDING",
            },
          });

          try {
            await sendEmail({
              to: report.scheduleEmail,
              cc: report.scheduleCc && report.scheduleCc.length > 0 ? report.scheduleCc : undefined,
              subject: `[Quota BI] Relatório Agendado: ${report.title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                  <div style="margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 12px;">
                    <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 20px;">📊 Relatório BI Agendado: ${report.title}</h2>
                    <p style="color: #64748b; margin: 0; font-size: 13px;">Relatório automatizado de inteligência e consumo de LLMs</p>
                  </div>

                  <p style="font-size: 14px; line-height: 1.5; color: #334155;">
                    Seu relatório agendado foi gerado com sucesso para a organização <strong>${report.tenant?.name || 'Sua Conta'}</strong>.
                  </p>

                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px;">
                    <p style="margin: 0 0 8px 0;"><strong>Organização:</strong> ${report.tenant?.name || 'Sua Conta'}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Frequência:</strong> ${report.scheduleFrequency || 'WEEKLY'}</p>
                    <p style="margin: 0;"><strong>Horário de Envio:</strong> ${scheduleTime} (Fuso Horário BRT)</p>
                  </div>

                  ${publicUrl ? `
                    <div style="margin: 24px 0; text-align: center;">
                      <a href="${publicUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
                        🔗 Acessar Dashboard Interativo
                      </a>
                    </div>
                  ` : ''}

                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                  <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
                    Enviado automaticamente pelo Quota Analytics & Self-Service BI.
                  </p>
                </div>
              `,
            });

            await prisma.notification.update({
              where: { id: notification.id },
              data: {
                status: "SENT",
                sentAt: new Date(),
              },
            });

            await prisma.biReport.update({
              where: { id: report.id },
              data: { lastSentAt: now },
            });

            console.log(`[BI Reports Worker] ✅ E-mail do relatório BI "${report.title}" enviado com sucesso para ${report.scheduleEmail}!`);
          } catch (sendErr: any) {
            await prisma.notification.update({
              where: { id: notification.id },
              data: {
                status: "FAILED",
                error: sendErr?.message || String(sendErr),
              },
            });
            throw sendErr;
          }
        }
      } catch (err) {
        console.error(`Erro ao processar agendamento BI do relatório ${report.id}:`, err);
      }
    }
  }
}

export default new BIReportService();
