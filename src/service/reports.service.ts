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

    const dataRowsCount = lines.length - 1;
    const MAX_USAGE_IMPORT = 1000;
    if (dataRowsCount > MAX_USAGE_IMPORT) {
      throw new Error(`O limite máximo por importação é de ${MAX_USAGE_IMPORT} registros de consumo por lote. O arquivo enviado contém ${dataRowsCount} registros.`);
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
    const cleanContent = (csvContent || "").replace(/^\uFEFF/, "").trim();
    const lines = cleanContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const headerLine = lines[0];
    if (!headerLine) {
      throw new Error("Arquivo CSV vazio ou sem dados.");
    }

    // Detecta automaticamente o delimitador (, ou ;)
    const delimiter = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ";" : ",";

    // Busca os escopos cadastrados do tenant para mapear por nome
    const existingScopes = await prisma.scope.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    });

    const scopeMap = new Map<string, string>();
    for (const s of existingScopes) {
      scopeMap.set(s.name.toLowerCase().trim(), s.id);
    }

    // Checa se a primeira linha é cabeçalho (não contém e-mail com @)
    const firstRowCells = headerLine.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim().toLowerCase());
    const isFirstRowHeader = !firstRowCells.some((cell) => cell.includes("@"));

    let nameIndex = 0;
    let emailIndex = 1;
    let roleIndex = 2;
    let passwordIndex = 3;
    let scopeIndex = 4;
    let startIndex = 0;

    if (isFirstRowHeader) {
      startIndex = 1;
      const hName = firstRowCells.findIndex((h) => ["nome", "name", "usuario", "user"].includes(h));
      const hEmail = firstRowCells.findIndex((h) => ["email", "e-mail"].includes(h));
      const hRole = firstRowCells.findIndex((h) => ["role", "cargo", "funcao", "perfil"].includes(h));
      const hPass = firstRowCells.findIndex((h) => ["senha", "password", "pass"].includes(h));
      const hScope = firstRowCells.findIndex((h) => ["escopo", "scope", "escoponame", "scopename", "escopo_nome", "scope_name"].includes(h));

      if (hName !== -1) nameIndex = hName;
      if (hEmail !== -1) emailIndex = hEmail;
      if (hRole !== -1) roleIndex = hRole;
      if (hPass !== -1) passwordIndex = hPass;
      if (hScope !== -1) scopeIndex = hScope;
    }

    if (lines.length <= startIndex) {
      throw new Error("Arquivo CSV vazio ou sem linhas de dados.");
    }

    const dataRowsCount = lines.length - startIndex;
    const MAX_USERS_IMPORT = 500;
    if (dataRowsCount > MAX_USERS_IMPORT) {
      throw new Error(`O limite máximo por importação é de ${MAX_USERS_IMPORT} usuários por lote. O arquivo enviado contém ${dataRowsCount} registros.`);
    }

    let createdUsers = 0;
    let existingCount = 0;
    const errors: string[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const currentLine = lines[i];
      if (!currentLine) continue;

      const row = currentLine.split(delimiter).map((cell) => cell.replace(/^"|"$/g, "").trim());
      if (row.length < 2) continue;

      try {
        // Formato esperado: Nome, Email, [Role], [Senha], [Escopo]
        const name = row[nameIndex] || "";
        const email = (row[emailIndex] || "").toLowerCase();
        const role = (row[roleIndex] || "ANALYST").toUpperCase();
        const rawPassword = row[passwordIndex] || "Quota@123456";
        const scopeName = (row[scopeIndex] || "").trim();

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

        let scopeId: string | null = null;
        if (scopeName) {
          const matchedId = scopeMap.get(scopeName.toLowerCase());
          if (matchedId) {
            scopeId = matchedId;
          } else {
            errors.push(`Linha ${i + 1}: Escopo "${scopeName}" não foi encontrado (usuário cadastrado sem escopo).`);
          }
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
            scopeId,
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
    const currentHHmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentDayOfWeek = now.getDay(); // 0 (Dom) - 6 (Sáb)
    const currentDayOfMonth = now.getDate(); // 1 - 31

    const schedules = await prisma.reportSchedule.findMany({
      where: { enabled: true }
    });

    if (!schedules || schedules.length === 0) return;

    for (const schedule of schedules) {
      try {
        const scheduleTime = schedule.time || "08:00";

        // Checa se já foi enviado HOJE no horário agendado ou depois
        if (schedule.lastSentAt) {
          const lastSent = new Date(schedule.lastSentAt);
          const isSameDay = lastSent.getFullYear() === now.getFullYear() &&
                            lastSent.getMonth() === now.getMonth() &&
                            lastSent.getDate() === now.getDate();

          const lastSentHHmm = `${String(lastSent.getHours()).padStart(2, "0")}:${String(lastSent.getMinutes()).padStart(2, "0")}`;

          if (isSameDay && lastSentHHmm >= scheduleTime) {
            continue; // Já foi enviado no horário de hoje
          }
        }

        // Verifica se o horário atual já atingiu ou passou do horário configurado
        if (currentHHmm < scheduleTime) {
          continue; // Ainda não deu o horário de envio de hoje
        }

        let isDue = false;

        if (schedule.frequency === "DAILY") {
          isDue = true;
        } else if (schedule.frequency === "WEEKLY") {
          isDue = schedule.dayOfWeek === null || schedule.dayOfWeek === undefined || currentDayOfWeek === Number(schedule.dayOfWeek);
        } else if (schedule.frequency === "MONTHLY") {
          isDue = schedule.dayOfMonth === null || schedule.dayOfMonth === undefined || currentDayOfMonth === Number(schedule.dayOfMonth);
        }

        if (isDue) {
          console.log(`[Reports Service] 📧 Disparando agendamento "${schedule.name}" para ${schedule.email} (Horário Configurado: ${scheduleTime}, Atual: ${currentHHmm})...`);

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

          console.log(`[Reports Service] ✅ E-mail do relatório "${schedule.name}" enviado com sucesso para ${schedule.email}!`);
        }
      } catch (err) {
        console.error(`Erro ao processar agendamento de relatório ${schedule.id}:`, err);
      }
    }
  }
}

export default new ReportsService();
