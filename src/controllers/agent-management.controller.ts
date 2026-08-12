import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import { getPlanLimits } from "../config/plan-limits";
import auditService from "../service/audit.service";

export class AgentManagementController {

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

      const agents = await (prisma as any).agent.findMany({
        where: { tenantId },
        orderBy: { name: "asc" }
      });

      return reply.status(200).send(agents);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao listar agentes" });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const actor = (request as AuthenticatedRequest).user;
      if (!actor) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = (request.body as any) || {};
      const { name, description } = body;
      const paramTenantId = (request.params as any)?.tenantId;
      const bodyTenantId = body?.tenantId;
      const tenantId = paramTenantId || bodyTenantId || actor.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "tenantId é obrigatório" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      if (!name || typeof name !== "string" || !name.trim()) {
        return reply.status(400).send({ error: "Nome do agente é obrigatório" });
      }

      const normalizedName = name.trim();

      const existing = await (prisma as any).agent.findFirst({
        where: { tenantId, name: normalizedName }
      });

      if (existing) {
        return reply.status(409).send({ error: "Já existe um agente com este nome" });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
      const currentAgentCount = await (prisma as any).agent.count({ where: { tenantId } });
      const limits = getPlanLimits(tenant?.plan);
      if (currentAgentCount >= limits.maxAgents) {
        return reply.status(403).send({
          error: `Limite de ${limits.maxAgents} agente(s) atingido para o plano ${tenant?.plan ?? 'STARTER'}. Faça upgrade para adicionar mais agentes.`
        });
      }

      const agent = await (prisma as any).agent.create({
        data: {
          tenantId,
          name: normalizedName,
          description: description?.trim() || null
        }
      });

      await auditService.logEvent({
        tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'METADATA',
        action: 'AGENT_CREATE',
        actionTitle: `Agente "${agent.name}" Criado`,
        details: `Agente de metadados "${agent.name}" cadastrado`,
        metadata: { agentId: agent.id, name: agent.name }
      });

      return reply.status(201).send(agent);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao criar agente" });
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

      const existing = await (prisma as any).agent.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({ error: "Agente não encontrado" });
      }

      if (actor.role !== "ADMIN" && actor.tenantId !== existing.tenantId) {
        return reply.status(403).send({ error: "Sem permissão para este tenant" });
      }

      await (prisma as any).agent.delete({
        where: { id: existing.id }
      });

      await auditService.logEvent({
        tenantId: existing.tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'METADATA',
        action: 'AGENT_DELETE',
        actionTitle: `Agente "${existing.name}" Excluído`,
        details: `Agente de metadados "${existing.name}" foi removido`,
        metadata: { agentId: existing.id, name: existing.name }
      });

      return reply.status(200).send({ message: "Agente excluído com sucesso" });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Erro ao excluir agente" });
    }
  }
}

export default new AgentManagementController();
