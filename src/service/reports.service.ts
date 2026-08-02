import { prisma } from "../lib/prisma";
import { sendEmail } from "./email.service";
import * as argon2 from "argon2";

export type ExportReportParams = {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  billingGroupId?: string;
  project?: string;
  agent?: string;
  provider?: string;
};

export class ReportsService {
  /**
   * Exporta logs detalhados (dado por dado) em formato CSV
   */
  async generateDetailedCsv(params: ExportReportParams): Promise<string> {
    const { tenantId, startDate, endDate, billingGroupId, project, agent, provider } = params;

    const where: any = { tenantId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (billingGroupId) where.billingGroupId = billingGroupId;
    if (project) where.project = project;
    if (agent) where.agent = agent;
    if (provider) where.provider = provider as any;

    const logs = await prisma.usageLog.findMany({
      where,
      include: { billingGroup: true },
      orderBy: { createdAt: "desc" },
      take: 10000, // Limite de 10.000 linhas por exportação
    });

    const headers = [
      "ID",
      "Data e Hora",
      "Grupo de Faturamento",
      "Projeto",
      "Agente",
      "Provedor",
      "Modelo",
      "Prompt Tokens",
      "Completion Tokens",
      "Total Tokens",
      "Custo Estimado (USD)",
      "Latencia (ms)",
      "Sucesso"
    ];

    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.billingGroup?.name || log.billingGroupId || "N/A",
      log.project || "N/A",
      log.agent || "N/A",
      log.provider,
      log.model,
      log.promptTokens,
      log.completionTokens,
      log.totalTokens,
      log.estimatedCost.toFixed(6),
      log.latencyMs,
      log.success ? "Sim" : "Nao"
    ]);

    const csvLines = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))];
    return csvLines.join("\n");
  }

  /**
   * Exporta os totais e resumos consolidados do Dashboard (Overview) em formato CSV
   */
  async generateOverviewCsv(params: ExportReportParams): Promise<string> {
    const { tenantId, startDate, endDate, billingGroupId, project, agent } = params;

    const where: any = { tenantId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (billingGroupId) where.billingGroupId = billingGroupId;
    if (project) where.project = project;
    if (agent) where.agent = agent;

    const totals = await prisma.usageLog.aggregate({
      where,
      _count: { id: true },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true, estimatedCost: true },
      _avg: { latencyMs: true }
    });

    const providerGroup = await prisma.usageLog.groupBy({
      by: ["provider"],
      where,
      _sum: { estimatedCost: true, totalTokens: true },
      _count: { id: true }
    });

    const lines: string[] = [];

    // Cabeçalho Principal do Relatório Consolidado
    lines.push(`"RELATORIO CONSOLIDADO DO DASHBOARD (OVERVIEW)"`);
    lines.push(`"Periodo:","${startDate ? startDate.toLocaleDateString('pt-BR') : 'Inicio'} ate ${endDate ? endDate.toLocaleDateString('pt-BR') : 'Hoje'}"`);
    lines.push(`"Total de Requisicoes:","${totals._count.id || 0}"`);
    lines.push(`"Total de Tokens:","${totals._sum.totalTokens || 0}"`);
    lines.push(`"Custo Total Estimado (USD):","${(totals._sum.estimatedCost || 0).toFixed(4)}"` );
    lines.push(`"Latencia Media (ms):","${(totals._avg.latencyMs || 0).toFixed(0)}"` );
    lines.push("");

    // Divisão por Provedor
    lines.push(`"DIVISAO POR PROVEDOR DE IA"`);
    lines.push(`"Provedor","Requisicoes","Total Tokens","Custo Estimado (USD)"`);

    for (const pg of providerGroup) {
      lines.push(`"${pg.provider}","${pg._count.id}","${pg._sum.totalTokens || 0}","${(pg._sum.estimatedCost || 0).toFixed(4)}"`);
    }

    return lines.join("\n");
  }

  /**
   * Importa registros de consumo histórico em lote via texto/arquivo CSV
   */
  async importUsageCsv(tenantId: string, csvContent: string) {
    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      throw new Error("Arquivo CSV vazio ou sem dados.");
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i];
      if (!currentLine) continue;

      const row = currentLine.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim());
      if (row.length < 5) continue;

      try {
        // Formato esperado: Provider, Model, PromptTokens, CompletionTokens, EstimatedCost, [Project], [Agent]
        const providerStr = (row[0] || "openai").toLowerCase();
        const modelStr = row[1] || "gpt-4o";
        const promptTokens = parseInt(row[2] || "0") || 0;
        const completionTokens = parseInt(row[3] || "0") || 0;
        const estimatedCost = parseFloat(row[4] || "0") || 0;
        const projectStr = row[5] || null;
        const agentStr = row[6] || null;

        await prisma.usageLog.create({
          data: {
            tenantId,
            provider: providerStr as any,
            model: modelStr,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedCost,
            project: projectStr,
            agent: agentStr,
            success: true,
            latencyMs: 100,
          }
        });

        importedCount++;
      } catch (err: any) {
        errors.push(`Linha ${i + 1}: ${err.message || 'Erro ao parsear linha'}`);
      }
    }

    return { importedCount, errors };
  }

  /**
   * Importa cadastro de usuários da empresa em lote via arquivo CSV
   */
  async importUsersCsv(tenantId: string, csvContent: string) {
    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      throw new Error("Arquivo CSV vazio ou sem dados.");
    }

    let createdUsers = 0;
    let existingCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i];
      if (!currentLine) continue;

      const row = currentLine.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim());
      if (row.length < 2) continue;

      try {
        // Formato esperado: Nome, Email, [Role], [Senha]
        const name = row[0] || "";
        const email = (row[1] || "").toLowerCase();
        const role = (row[2] || "ANALYST").toUpperCase();
        const rawPassword = row[3] || "Quota@123456";

        if (!email || !email.includes("@")) {
          errors.push(`Linha ${i + 1}: E-mail inválido (${email})`);
          continue;
        }

        const existing = await prisma.user.findFirst({
          where: { email, tenantId }
        });

        if (existing) {
          existingCount++;
          continue;
        }

        const hashedPassword = await argon2.hash(rawPassword);

        const validRole = ["ADMIN", "MANAGER", "ANALYST", "DEV"].includes(role) ? (role as any) : "ANALYST";

        await prisma.user.create({
          data: {
            tenantId,
            name: name || email.split("@")[0] || "Usuário",
            email,
            passwordHash: hashedPassword,
            role: validRole,
          }
        });

        createdUsers++;
      } catch (err: any) {
        errors.push(`Linha ${i + 1}: ${err.message || 'Erro ao cadastrar usuário'}`);
      }
    }

    return { createdUsers, existingCount, errors };
  }

  /**
   * Processa os relatórios agendados vencidos e dispara os e-mails com os anexos CSV
   */
  async processDueReportSchedules() {
    const now = new Date();

    const schedules = await prisma.reportSchedule.findMany({
      where: { enabled: true }
    });

    for (const schedule of schedules) {
      try {
        let isDue = false;

        if (!schedule.lastSentAt) {
          isDue = true;
        } else {
          const last = new Date(schedule.lastSentAt);
          if (schedule.frequency === "DAILY") {
            isDue = last.getDate() !== now.getDate() || last.getMonth() !== now.getMonth();
          } else if (schedule.frequency === "WEEKLY") {
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            isDue = diffDays >= 7 && (schedule.dayOfWeek === null || now.getDay() === schedule.dayOfWeek);
          } else if (schedule.frequency === "MONTHLY") {
            isDue = last.getMonth() !== now.getMonth() && (schedule.dayOfMonth === null || now.getDate() === schedule.dayOfMonth);
          }
        }

        if (isDue) {
          const params: ExportReportParams = {
            tenantId: schedule.tenantId,
            billingGroupId: schedule.billingGroupId || undefined,
            project: schedule.project || undefined,
            agent: schedule.agent || undefined,
            provider: schedule.provider || undefined,
          };

          const detailedCsv = await this.generateDetailedCsv(params);
          const overviewCsv = await this.generateOverviewCsv(params);

          const attachments: any[] = [];

          if (schedule.reportType === "DETAILED_LOGS" || schedule.reportType === "BOTH") {
            attachments.push({
              filename: `relatorio-detalhado-${schedule.name.toLowerCase().replace(/\s+/g, '-')}.csv`,
              content: detailedCsv,
              contentType: "text/csv"
            });
          }

          if (schedule.reportType === "OVERVIEW_DASHBOARD" || schedule.reportType === "BOTH") {
            attachments.push({
              filename: `relatorio-overview-${schedule.name.toLowerCase().replace(/\s+/g, '-')}.csv`,
              content: overviewCsv,
              contentType: "text/csv"
            });
          }

          await sendEmail({
            to: schedule.email,
            cc: schedule.ccEmails,
            subject: `[Quota Report] ${schedule.name} (${schedule.frequency})`,
            html: `
              <h2>Relatório Agendado: ${schedule.name}</h2>
              <p>Segue em anexo o relatório automatizado gerado pelo Quota para a sua organização.</p>
              <ul>
                <li><strong>Frequência:</strong> ${schedule.frequency}</li>
                <li><strong>Data de Geração:</strong> ${now.toLocaleString("pt-BR")}</li>
              </ul>
              <p>Os arquivos CSV detalhados estão em anexo.</p>
            `,
            attachments
          });

          await prisma.reportSchedule.update({
            where: { id: schedule.id },
            data: { lastSentAt: now }
          });
        }
      } catch (err) {
        console.error(`Erro ao processar agendamento de relatório ${schedule.id}:`, err);
      }
    }
  }
}

export default new ReportsService();
