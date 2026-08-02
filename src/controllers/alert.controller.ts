import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import { PrismaClient } from "@prisma/client";
import { processAlerts } from "../service/alert-engine.service";
import { triggerAlert } from "../service/alert.service";


const prisma = new PrismaClient();


class AlertController {

  async create(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = request.body as any;
      const targetTenantId = body?.tenantId || actor.tenantId;

      if (actor.role !== "ADMIN" && actor.tenantId !== targetTenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const {
        type: rawType,
        period,
        threshold,
        email,
        ccEmails,
        cc,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        timezone,
        provider,
        model,
        project,
        agent,
        billingGroupId
      } = body;

      const typeMap: Record<string, string> = {
        COST_THRESHOLD: "COST",
        TOKEN_THRESHOLD: "TOKENS",
        ERROR_RATE: "ERRORS",
        LATENCY: "LATENCY",
        BUDGET_THRESHOLD: "BUDGET",
        COST: "COST",
        TOKENS: "TOKENS",
        ERRORS: "ERRORS",
        BUDGET: "BUDGET"
      };

      const type = typeMap[rawType] || rawType;

      if (!targetTenantId || !type || !period || threshold === undefined || !email) {
        return reply.status(400).send({
          error: "tenantId, type, period, threshold e email são obrigatórios"
        });
      }

      const parsedCcEmails = Array.isArray(ccEmails)
        ? ccEmails.map((item: any) => String(item).trim()).filter(Boolean)
        : typeof ccEmails === "string"
        ? ccEmails.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
        : typeof cc === "string"
        ? cc.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
        : [];

      const alert = await prisma.alertConfig.create({
        data: {
          tenantId: targetTenantId,
          type: type as any,
          period: period as any,
          threshold: Number(threshold),
          email,
          ccEmails: parsedCcEmails,
          quietHoursEnabled: Boolean(quietHoursEnabled),
          quietHoursStart: quietHoursEnabled ? quietHoursStart || null : null,
          quietHoursEnd: quietHoursEnabled ? quietHoursEnd || null : null,
          timezone: timezone || "America/Sao_Paulo",
          provider: provider || null,
          model: model || null,
          project: project || null,
          agent: agent || null,
          billingGroupId: billingGroupId || null,
          budgetId: body.budgetId || null,
          thresholdType: body.thresholdType || "PERCENTAGE"
        }
      });

      return reply.status(201).send({
        message: "Alerta criado com sucesso",
        alert
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error?.message || "Erro ao criar alerta" });
    }
  }

  async list(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "Tenant missing" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const alerts = await prisma.alertConfig.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" }
      });

      const items = alerts.map(alert => ({
        ...alert,
        type: alert.type === "COST" ? "COST_THRESHOLD" : alert.type === "TOKENS" ? "TOKEN_THRESHOLD" : alert.type === "ERRORS" ? "ERROR_RATE" : alert.type,
        rawType: alert.type
      }));

      return reply.send(items);
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: "Erro ao listar alertas" });
    }
  }

  async process(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "Tenant missing" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      await processAlerts(tenantId);

      return reply.send({ message: "Alertas processados com sucesso" });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: "Erro ao processar alertas" });
    }
  }

  async test(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { alertConfigId } = request.params as { alertConfigId: string };

      const alertConfig = await prisma.alertConfig.findUnique({
        where: { id: alertConfigId }
      });

      if (!alertConfig) {
        return reply.status(404).send({ error: "Alerta não encontrado" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== alertConfig.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      await triggerAlert({
        alertConfigId,
        title: "Teste de alerta Quota",
        message: "Este é um teste manual do sistema de alertas."
      });

      return reply.send({ message: "Alerta de teste enviado" });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: "Erro ao enviar alerta de teste" });
    }
  }

  async notifications(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "Tenant missing" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const notifications = await prisma.notification.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100
      });

      return reply.send(notifications);
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: "Erro ao buscar notificações" });
    }
  }

  async update(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      if (!id) {
        return reply.status(400).send({ error: "ID do alerta é obrigatório" });
      }

      const existing = await prisma.alertConfig.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({ error: "Alerta não encontrado" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== existing.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const body = (request.body as any) || {};
      const dataToUpdate: any = {};

      if (body.type) {
        const typeMap: Record<string, string> = {
          COST_THRESHOLD: "COST",
          TOKEN_THRESHOLD: "TOKENS",
          ERROR_RATE: "ERRORS",
          LATENCY: "LATENCY",
          BUDGET_THRESHOLD: "BUDGET",
          COST: "COST",
          TOKENS: "TOKENS",
          ERRORS: "ERRORS",
          BUDGET: "BUDGET"
        };
        dataToUpdate.type = typeMap[body.type] || body.type;
      }

      if (body.period !== undefined) dataToUpdate.period = body.period;
      if (body.threshold !== undefined) dataToUpdate.threshold = Number(body.threshold);
      if (body.email !== undefined) dataToUpdate.email = String(body.email).trim();
      if (body.ccEmails !== undefined || body.cc !== undefined) {
        const rawCc = body.ccEmails !== undefined ? body.ccEmails : body.cc;
        dataToUpdate.ccEmails = Array.isArray(rawCc)
          ? rawCc.map((item: any) => String(item).trim()).filter(Boolean)
          : typeof rawCc === "string"
          ? rawCc.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
          : [];
      }
      if (body.quietHoursEnabled !== undefined) dataToUpdate.quietHoursEnabled = Boolean(body.quietHoursEnabled);
      if (body.quietHoursStart !== undefined) dataToUpdate.quietHoursStart = body.quietHoursStart ? String(body.quietHoursStart).trim() : null;
      if (body.quietHoursEnd !== undefined) dataToUpdate.quietHoursEnd = body.quietHoursEnd ? String(body.quietHoursEnd).trim() : null;
      if (body.timezone !== undefined) dataToUpdate.timezone = body.timezone ? String(body.timezone).trim() : "America/Sao_Paulo";
      if (body.enabled !== undefined) dataToUpdate.enabled = Boolean(body.enabled);
      if (body.provider !== undefined) dataToUpdate.provider = body.provider ? (String(body.provider).trim() as any) : null;
      if (body.model !== undefined) dataToUpdate.model = body.model ? String(body.model).trim() : null;
      if (body.project !== undefined) dataToUpdate.project = body.project ? String(body.project).trim() : null;
      if (body.agent !== undefined) dataToUpdate.agent = body.agent ? String(body.agent).trim() : null;
      if (body.billingGroupId !== undefined) dataToUpdate.billingGroupId = body.billingGroupId || null;
      if (body.budgetId !== undefined) dataToUpdate.budgetId = body.budgetId || null;
      if (body.thresholdType !== undefined) dataToUpdate.thresholdType = body.thresholdType || "PERCENTAGE";

      const updated = await prisma.alertConfig.update({
        where: { id },
        data: dataToUpdate
      });

      return reply.send({
        message: "Alerta atualizado com sucesso",
        alert: {
          ...updated,
          type: updated.type === "COST" ? "COST_THRESHOLD" : updated.type === "TOKENS" ? "TOKEN_THRESHOLD" : updated.type === "ERRORS" ? "ERROR_RATE" : updated.type,
          rawType: updated.type
        }
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error?.message || "Erro ao atualizar alerta" });
    }
  }

  async delete(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      if (!id) {
        return reply.status(400).send({ error: "ID do alerta é obrigatório" });
      }

      const existing = await prisma.alertConfig.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({ error: "Alerta não encontrado" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== existing.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      await prisma.alertConfig.delete({
        where: { id }
      });

      return reply.send({ message: "Alerta excluído com sucesso" });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(400).send({ error: error?.message || "Erro ao excluir alerta" });
    }
  }

}

export default new AlertController();