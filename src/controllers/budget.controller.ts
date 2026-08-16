import type { FastifyReply, FastifyRequest } from "fastify";
import { AlertPeriod, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { getPlanLimits } from "../config/plan-limits";
import auditService from "../service/audit.service";


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

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
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
            autoBlock: Boolean(budget.autoBlock),
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

  async validate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      const query = (request.query as any) || {};
      const params = (request.params as any) || {};

      const tenantId = params.tenantId || query.tenantId || actor?.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ error: "tenantId é obrigatório" });
      }

      const { billingGroupId, billingGroup, project, agent } = query;

      const budgets = await prisma.budget.findMany({
        where: {
          tenantId,
          autoBlock: true,
        },
        include: { billingGroup: true }
      });

      if (!budgets || budgets.length === 0) {
        return reply.status(200).send({
          allowed: true,
          message: "Nenhum orçamento com bloqueio automático configurado",
        });
      }

      for (const budget of budgets) {
        let isApplicable = false;

        if (budget.billingGroupId) {
          if (billingGroupId && budget.billingGroupId === String(billingGroupId)) {
            isApplicable = true;
          } else if (billingGroup && budget.billingGroup?.name?.toLowerCase().trim() === String(billingGroup).toLowerCase().trim()) {
            isApplicable = true;
          }
        }
        if (budget.project && project && budget.project.toLowerCase().trim() === String(project).toLowerCase().trim()) {
          isApplicable = true;
        }
        if (budget.agent && agent && budget.agent.toLowerCase().trim() === String(agent).toLowerCase().trim()) {
          isApplicable = true;
        }
        if (!budget.billingGroupId && !budget.project && !budget.agent) {
          isApplicable = true;
        }

        if (isApplicable) {
          const startDate = getPeriodDate(budget.period);
          const where: Prisma.UsageLogWhereInput = {
            tenantId,
            createdAt: { gte: startDate }
          };

          if (budget.billingGroupId) where.billingGroupId = budget.billingGroupId;
          if (budget.project) where.project = budget.project;
          if (budget.agent) where.agent = budget.agent;

          const usage = await prisma.usageLog.aggregate({
            where,
            _sum: { estimatedCost: true }
          });

          const used = Number(usage._sum.estimatedCost ?? 0);
          const limit = Number(budget.limit);

          if (limit > 0 && used >= limit) {
            const targetName = budget.project
              ? `Projeto ${budget.project}`
              : budget.agent
              ? `Agente ${budget.agent}`
              : budget.billingGroup?.name
              ? `Grupo ${budget.billingGroup.name}`
              : "Global";

            return reply.status(200).send({
              allowed: false,
              reason: `Orçamento excedido para ${targetName}`,
              limit: Number(limit.toFixed(2)),
              used: Number(used.toFixed(2)),
              remaining: 0,
              budget: {
                id: budget.id,
                billingGroupId: budget.billingGroupId,
                project: budget.project,
                agent: budget.agent,
                autoBlock: true,
              }
            });
          }
        }
      }

      return reply.status(200).send({
        allowed: true,
        message: "Consumo dentro do orçamento permitido",
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao validar orçamento" });
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

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const { limit, period, billingGroupId, project, agent, autoBlock } = body;

      if (autoBlock) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
        const limits = getPlanLimits(tenant?.plan);
        if (!limits.canAutoBlockBudget) {
          return reply.status(403).send({
            error: "O recurso de Auto-Block (bloqueio automático por estouro de orçamento) está disponível a partir do plano PRO."
          });
        }
      }

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
          agent: agent?.trim() || null,
          autoBlock: Boolean(autoBlock),
        },
        include: { billingGroup: true }
      });

      await auditService.logEvent({
        tenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'BUDGET',
        action: 'BUDGET_CREATE',
        actionTitle: `Orçamento de R$ ${budget.limit.toFixed(2)} Criado`,
        details: `Novo orçamento de R$ ${budget.limit.toFixed(2)} (${budget.period}) configurado${budget.autoBlock ? ' com auto-bloqueio' : ''}`,
        metadata: { budgetId: budget.id, limit: budget.limit, period: budget.period, autoBlock: budget.autoBlock }
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

      if (actor.role !== "ADMIN" && actor.tenantId !== existing.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      const body = (request.body as any) || {};
      const { limit, period, billingGroupId, project, agent, autoBlock } = body;

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

      if (autoBlock !== undefined) {
        if (Boolean(autoBlock)) {
          const tenant = await prisma.tenant.findUnique({ where: { id: existing.tenantId }, select: { plan: true } });
          const limits = getPlanLimits(tenant?.plan);
          if (!limits.canAutoBlockBudget) {
            return reply.status(403).send({
              error: "O recurso de Auto-Block (bloqueio automático por estouro de orçamento) está disponível a partir do plano PRO."
            });
          }
        }
        dataToUpdate.autoBlock = Boolean(autoBlock);
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

      await auditService.logEvent({
        tenantId: existing.tenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'BUDGET',
        action: 'BUDGET_UPDATE',
        actionTitle: `Orçamento Alterado (Limite: R$ ${updated.limit.toFixed(2)})`,
        details: `Orçamento atualizado para limite de R$ ${updated.limit.toFixed(2)} (${updated.period})`,
        metadata: { budgetId: updated.id, limit: updated.limit, period: updated.period }
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

      if (actor.role !== "ADMIN" && actor.tenantId !== existing.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      await prisma.budget.delete({
        where: { id }
      });

      await auditService.logEvent({
        tenantId: existing.tenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'BUDGET',
        action: 'BUDGET_DELETE',
        actionTitle: `Orçamento Excluído`,
        details: `Regra de orçamento de R$ ${existing.limit.toFixed(2)} removida`,
        metadata: { budgetId: existing.id }
      });

      return reply.status(200).send({ message: "Orçamento excluído com sucesso" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao excluir orçamento" });
    }
  }
}

export default new BudgetController();
