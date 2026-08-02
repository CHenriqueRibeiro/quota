import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";
import reportsService from "../service/reports.service";

const prisma = new PrismaClient();

export class ReportsController {
  async exportDetailed(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) return reply.status(401).send({ error: "Unauthorized" });

      const query = (request.query as any) || {};
      const body = (request.body as any) || {};
      const tenantId = query.tenantId || body.tenantId || actor.tenantId;

      if (!tenantId) return reply.status(400).send({ error: "tenantId é obrigatório" });

      const startDate = query.startDate || body.startDate ? new Date(query.startDate || body.startDate) : undefined;
      const endDate = query.endDate || body.endDate ? new Date(query.endDate || body.endDate) : undefined;

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

      const startDate = query.startDate || body.startDate ? new Date(query.startDate || body.startDate) : undefined;
      const endDate = query.endDate || body.endDate ? new Date(query.endDate || body.endDate) : undefined;

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
      const { name, frequency, time, email, ccEmails, reportType, format, billingGroupId, project, agent, provider, dayOfWeek, dayOfMonth } = body;

      if (!name || !frequency || !email) {
        return reply.status(400).send({ error: "Nome, frequência e e-mail são obrigatórios" });
      }

      const parsedCcEmails = Array.isArray(ccEmails)
        ? ccEmails.map((item: any) => String(item).trim()).filter(Boolean)
        : typeof ccEmails === "string"
        ? ccEmails.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
        : [];

      const schedule = await prisma.reportSchedule.create({
        data: {
          tenantId,
          name: name.trim(),
          frequency: frequency as any,
          time: time || "08:00",
          dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : null,
          dayOfMonth: dayOfMonth !== undefined ? Number(dayOfMonth) : null,
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
      if (body.frequency) dataToUpdate.frequency = body.frequency;
      if (body.time) dataToUpdate.time = body.time;
      if (body.dayOfWeek !== undefined) dataToUpdate.dayOfWeek = body.dayOfWeek !== null ? Number(body.dayOfWeek) : null;
      if (body.dayOfMonth !== undefined) dataToUpdate.dayOfMonth = body.dayOfMonth !== null ? Number(body.dayOfMonth) : null;
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
      await prisma.reportSchedule.delete({ where: { id } });
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
