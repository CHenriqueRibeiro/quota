import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient, AlertPeriod, Prisma } from "@prisma/client";
import type { AuthenticatedRequest } from "../types/auth";

const prisma = new PrismaClient();

function getPeriodDate(period: AlertPeriod): Date {
  const now = new Date();
  if (period === "DAILY") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  // MONTHLY e default
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getBudgetStatus(usagePercentage: number): string {
  if (usagePercentage >= 100) return "Estourado";
  if (usagePercentage >= 90) return "Crítico";
  if (usagePercentage >= 75) return "Atenção";
  return "Saudável";
}

export class BudgetController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const tenantId = paramTenantId || queryTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "tenantId é obrigatório" });
      }

      if (actor.role !== "OWNER" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const budgets = await prisma.budget.findMany({
        where: { tenantId },
        include: { billingGroup: true },
        orderBy: { createdAt: "desc" }
      });

      const items = await Promise.all(
        budgets.map(async (budget) => {
          const startDate = getPeriodDate(budget.period);
          const where: Prisma.UsageLogWhereInput = {
            tenantId,
            createdAt: { gte: startDate }
          };

          if (budget.billingGroupId) {
            where.billingGroupId = budget.billingGroupId;
          }
          if (budget.project) {
            where.project = budget.project;
          }
          if (budget.agent) {
            where.agent = budget.agent;
          }

          const usage = await prisma.usageLog.aggregate({
            where,
            _sum: { estimatedCost: true }
          });

          const used = Number(usage._sum.estimatedCost ?? 0);
          const limit = Number(budget.limit);
          const remaining = Math.max(0, limit - used);
          const usagePercentage = limit > 0 ? Number(((used / limit) * 100).toFixed(2)) : 0;
          const status = getBudgetStatus(usagePercentage);

          return {
            id: budget.id,
            tenantId: budget.tenantId,
            billingGroupId: budget.billingGroupId,
            billingGroupName: budget.billingGroup?.name ?? null,
            project: budget.project,
            agent: budget.agent,
            limit,
            period: budget.period,
            used: Number(used.toFixed(2)),
            remaining: Number(remaining.toFixed(2)),
            usagePercentage,
            status,
            createdAt: budget.createdAt,
            updatedAt: budget.updatedAt
          };
        })
      );

      return reply.status(200).send(items);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao listar orçamentos" });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = (request.body as any) || {};
      const paramTenantId = (request.params as any)?.tenantId;
      const tenantId = paramTenantId || body.tenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "tenantId é obrigatório" });
      }

      if (actor.role !== "OWNER" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const { limit, period, billingGroupId, project, agent } = body;

      if (limit === undefined || limit === null || Number(limit) <= 0) {
        return reply.status(400).send({ error: "Limite deve ser um número maior que zero" });
      }

      const parsedPeriod: AlertPeriod = period === "DAILY" ? "DAILY" : "MONTHLY";

      if (billingGroupId) {
        const bg = await prisma.billingGroup.findFirst({
          where: { id: billingGroupId, tenantId }
        });
        if (!bg) {
          return reply.status(404).send({ error: "Grupo de faturamento não encontrado" });
        }
      }

      const budget = await prisma.budget.create({
        data: {
          tenantId,
          limit: Number(limit),
          period: parsedPeriod,
          billingGroupId: billingGroupId || null,
          project: project?.trim() || null,
          agent: agent?.trim() || null
        },
        include: { billingGroup: true }
      });

      return reply.status(201).send(budget);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao criar orçamento" });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      if (!id) {
        return reply.status(400).send({ error: "id é obrigatório" });
      }

      const existing = await prisma.budget.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({ error: "Orçamento não encontrado" });
      }

      if (actor.role !== "OWNER" && actor.tenantId !== existing.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const body = (request.body as any) || {};
      const { limit, period, billingGroupId, project, agent } = body;

      const dataToUpdate: any = {};

      if (limit !== undefined && limit !== null) {
        if (Number(limit) <= 0) {
          return reply.status(400).send({ error: "Limite deve ser maior que zero" });
        }
        dataToUpdate.limit = Number(limit);
      }

      if (period !== undefined) {
        dataToUpdate.period = period === "DAILY" ? "DAILY" : "MONTHLY";
      }

      if (billingGroupId !== undefined) {
        if (billingGroupId) {
          const bg = await prisma.billingGroup.findFirst({
            where: { id: billingGroupId, tenantId: existing.tenantId }
          });
          if (!bg) {
            return reply.status(404).send({ error: "Grupo de faturamento não encontrado" });
          }
          dataToUpdate.billingGroupId = billingGroupId;
        } else {
          dataToUpdate.billingGroupId = null;
        }
      }

      if (project !== undefined) {
        dataToUpdate.project = project ? String(project).trim() : null;
      }

      if (agent !== undefined) {
        dataToUpdate.agent = agent ? String(agent).trim() : null;
      }

      const updated = await prisma.budget.update({
        where: { id },
        data: dataToUpdate,
        include: { billingGroup: true }
      });

      return reply.status(200).send(updated);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao atualizar orçamento" });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = (request.params as any) || {};
      if (!id) {
        return reply.status(400).send({ error: "id é obrigatório" });
      }

      const existing = await prisma.budget.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({ error: "Orçamento não encontrado" });
      }

      if (actor.role !== "OWNER" && actor.tenantId !== existing.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      await prisma.budget.delete({
        where: { id }
      });

      return reply.status(200).send({ message: "Orçamento excluído com sucesso" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao excluir orçamento" });
    }
  }
}

export default new BudgetController();
