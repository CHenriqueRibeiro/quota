import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import reportsService from "../service/reports.service";
import { getPlanLimits } from "../config/plan-limits";
import auditService from "../service/audit.service";
import { parseBrasiliaStartDate, parseBrasiliaEndDate } from "../lib/timezone";

export class ReportsController {

  async exportDetailed(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const query = (request.query as any) || {};
      const body = (request.body as any) || {};
      const tenantId = query.tenantId || body.tenantId || actor.tenantId;

      if (!tenantId) return reply.status(400).send({ error: "tenantId é obrigatório" });

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
      const limits = getPlanLimits(tenant?.plan);
      if (!limits.canExportReports) {
        return reply.status(403).send({
          error: "A exportação de relatórios em CSV/HTML está disponível a partir do plano PRO."
        });
      }

      const startDate = query.startDate || body.startDate ? parseBrasiliaStartDate(query.startDate || body.startDate) : undefined;

      const endDate = query.endDate || body.endDate ? parseBrasiliaEndDate(query.endDate || body.endDate) : undefined;

      const csvData = await reportsService.generateDetailedCsv({
        tenantId,
        startDate,
        endDate,
        billingGroupId: query.billingGroupId || body.billingGroupId,
        project: query.project || body.project,
        agent: query.agent || body.agent,
        provider: query.provider || body.provider,
      });

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="relatorio-detalhado-${Date.now()}.csv"`);
      return reply.status(200).send(csvData);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao exportar relatório detalhado em CSV" });
    }
  }

  async exportOverview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const query = (request.query as any) || {};
      const body = (request.body as any) || {};
      const tenantId = query.tenantId || body.tenantId || actor.tenantId;

      if (!tenantId) return reply.status(400).send({ error: "tenantId é obrigatório" });

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
      const limits = getPlanLimits(tenant?.plan);
      if (!limits.canExportReports) {
        return reply.status(403).send({
          error: "A exportação de relatórios em CSV/HTML está disponível a partir do plano PRO."
        });
      }

      const startDate = query.startDate || body.startDate ? parseBrasiliaStartDate(query.startDate || body.startDate) : undefined;

      const endDate = query.endDate || body.endDate ? parseBrasiliaEndDate(query.endDate || body.endDate) : undefined;

      const csvData = await reportsService.generateOverviewCsv({
        tenantId,
        startDate,
        endDate,
        billingGroupId: query.billingGroupId || body.billingGroupId,
        project: query.project || body.project,
        agent: query.agent || body.agent,
      });

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="relatorio-overview-${Date.now()}.csv"`);
      return reply.status(200).send(csvData);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao exportar resumo do dashboard em CSV" });
    }
  }

  async importUsage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const body = (request.body as any) || {};
      const tenantId = body.tenantId || actor.tenantId;
      const csvData = body.csvData || body.fileContent || (typeof body === "string" ? body : "");

      if (!csvData) {
        return reply.status(400).send({ error: "Conteúdo do CSV não informado" });
      }

      const result = await reportsService.importUsageCsv(tenantId, csvData);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message || "Erro ao importar CSV de consumo" });
    }
  }

  async importUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const body = (request.body as any) || {};
      const tenantId = body.tenantId || actor.tenantId;
      const csvData = body.csvData || body.fileContent || (typeof body === "string" ? body : "");

      if (!csvData) {
        return reply.status(400).send({ error: "Conteúdo do CSV não informado" });
      }

      const result = await reportsService.importUsersCsv(tenantId, csvData);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: error.message || "Erro ao importar usuários via CSV" });
    }
  }

  async listSchedules(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const query = (request.query as any) || {};
      const tenantId = query.tenantId || actor.tenantId;

      const schedules = await prisma.reportSchedule.findMany({
        where: { tenantId },
        include: { billingGroup: true },
        orderBy: { createdAt: "desc" }
      });

      return reply.status(200).send(schedules);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao listar agendamentos de relatórios" });
    }
  }

  async createSchedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const body = (request.body as any) || {};
      const tenantId = body.tenantId || actor.tenantId;

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
      const limits = getPlanLimits(tenant?.plan);
      if (!limits.canScheduleReports) {
        return reply.status(403).send({
          error: "O agendamento automático de relatórios por e-mail está disponível a partir do plano PRO."
        });
      }

      const { name, frequency, time, email, ccEmails, reportType, format, billingGroupId, project, agent, provider, dayOfWeek, dayOfMonth } = body;


      if (!name || !frequency || !email) {
        return reply.status(400).send({ error: "Nome, frequência e e-mail são obrigatórios" });
      }

      const parsedCcEmails = Array.isArray(ccEmails)
        ? ccEmails.map((item: any) => String(item).trim()).filter(Boolean)
        : typeof ccEmails === "string"
        ? ccEmails.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
        : [];

      let finalDayOfWeek: number | null = null;
      let finalDayOfMonth: number | null = null;

      if (frequency === "WEEKLY") {
        finalDayOfWeek = dayOfWeek !== undefined && dayOfWeek !== null && dayOfWeek !== "" ? Number(dayOfWeek) : 1; // Padrão: Segunda-feira (1)
      } else if (frequency === "MONTHLY") {
        finalDayOfMonth = dayOfMonth !== undefined && dayOfMonth !== null && dayOfMonth !== "" ? Number(dayOfMonth) : 1; // Padrão: Dia 1
      }

      const schedule = await prisma.reportSchedule.create({
        data: {
          tenantId,
          name: name.trim(),
          frequency: frequency as any,
          time: time || "08:00",
          dayOfWeek: finalDayOfWeek,
          dayOfMonth: finalDayOfMonth,
          email: email.trim(),
          ccEmails: parsedCcEmails,
          reportType: (reportType as any) || "BOTH",
          format: (format as any) || "BOTH",
          billingGroupId: billingGroupId || null,
          project: project?.trim() || null,
          agent: agent?.trim() || null,
          provider: provider || null,
        },
        include: { billingGroup: true }
      });

      await auditService.logEvent({
        tenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'SCHEDULES_EXPORTS',
        action: 'SCHEDULE_CREATE',
        actionTitle: `Agendamento "${schedule.name}" Criado`,
        details: `Agendamento de relatório "${schedule.name}" (${schedule.frequency} às ${schedule.time}) para ${schedule.email}`,
        metadata: { scheduleId: schedule.id, name: schedule.name, frequency: schedule.frequency, email: schedule.email }
      });

      return reply.status(201).send(schedule);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao criar agendamento de relatório" });
    }
  }

  async updateSchedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const { id } = (request.params as any) || {};
      const body = (request.body as any) || {};

      const existing = await prisma.reportSchedule.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: "Agendamento não encontrado" });

      const dataToUpdate: any = {};
      if (body.name) dataToUpdate.name = body.name.trim();

      const newFrequency = body.frequency || existing.frequency;
      if (body.frequency) dataToUpdate.frequency = body.frequency;
      if (body.time) dataToUpdate.time = body.time;

      if (newFrequency === "WEEKLY") {
        if (body.dayOfWeek !== undefined) {
          dataToUpdate.dayOfWeek = body.dayOfWeek !== null && body.dayOfWeek !== "" ? Number(body.dayOfWeek) : 1;
        }
        dataToUpdate.dayOfMonth = null;
      } else if (newFrequency === "MONTHLY") {
        if (body.dayOfMonth !== undefined) {
          dataToUpdate.dayOfMonth = body.dayOfMonth !== null && body.dayOfMonth !== "" ? Number(body.dayOfMonth) : 1;
        }
        dataToUpdate.dayOfWeek = null;
      } else if (newFrequency === "DAILY") {
        dataToUpdate.dayOfWeek = null;
        dataToUpdate.dayOfMonth = null;
      }

      if (body.email) dataToUpdate.email = body.email.trim();
      if (body.ccEmails !== undefined) {
        dataToUpdate.ccEmails = Array.isArray(body.ccEmails)
          ? body.ccEmails.map((item: any) => String(item).trim()).filter(Boolean)
          : typeof body.ccEmails === "string"
          ? body.ccEmails.split(/[,;]/).map((item: string) => item.trim()).filter(Boolean)
          : [];
      }
      if (body.reportType) dataToUpdate.reportType = body.reportType;
      if (body.format) dataToUpdate.format = body.format;
      if (body.enabled !== undefined) dataToUpdate.enabled = Boolean(body.enabled);
      if (body.billingGroupId !== undefined) dataToUpdate.billingGroupId = body.billingGroupId || null;
      if (body.project !== undefined) dataToUpdate.project = body.project ? body.project.trim() : null;
      if (body.agent !== undefined) dataToUpdate.agent = body.agent ? body.agent.trim() : null;
      if (body.provider !== undefined) dataToUpdate.provider = body.provider || null;

      const updated = await prisma.reportSchedule.update({
        where: { id },
        data: dataToUpdate,
        include: { billingGroup: true }
      });

      await auditService.logEvent({
        tenantId: existing.tenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'SCHEDULES_EXPORTS',
        action: 'SCHEDULE_UPDATE',
        actionTitle: `Agendamento "${updated.name}" Alterado`,
        details: `Configuração do agendamento "${updated.name}" atualizada (Frequência: ${updated.frequency}, Horário: ${updated.time})`,
        metadata: { scheduleId: updated.id, name: updated.name, enabled: updated.enabled }
      });

      return reply.status(200).send(updated);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao atualizar agendamento de relatório" });
    }
  }

  async deleteSchedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const { id } = (request.params as any) || {};
      const existing = await prisma.reportSchedule.findUnique({ where: { id } });
      await prisma.reportSchedule.delete({ where: { id } });

      if (existing) {
        await auditService.logEvent({
          tenantId: existing.tenantId,
          userId: actor?.id,
          userName: actor?.name,
          userEmail: actor?.email,
          userRole: actor?.role,
          category: 'SCHEDULES_EXPORTS',
          action: 'SCHEDULE_DELETE',
          actionTitle: `Agendamento "${existing.name}" Removido`,
          details: `Agendamento de relatório "${existing.name}" foi excluído`,
          metadata: { scheduleId: existing.id, name: existing.name }
        });
      }

      return reply.status(200).send({ message: "Agendamento excluído com sucesso" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao excluir agendamento de relatório" });
    }
  }

  async runScheduleNow(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      await reportsService.processDueReportSchedules();
      return reply.status(200).send({ message: "Verificação de relatórios executada com sucesso!" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao executar verificação de relatórios" });
    }
  }
}

export default new ReportsController();
