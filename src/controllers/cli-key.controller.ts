import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import { prisma } from '../lib/prisma';
import { getPlanLimits } from '../config/plan-limits';
import crypto from 'node:crypto';

export class CliKeyController {
  async createCliKey(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId ?? request.tenantId;

      if (!tenantId) {
        return reply.status(403).send({ error: 'Tenant indisponível.' });
      }

      const body = request.body as any;
      const {
        userId,
        name = 'default',
        description,
        agent,
        project,
        billingGroup,
        environment,
        tags
      } = body ?? {};

      const targetUserId = userId ?? request.user?.id;

      if (!targetUserId) {
        return reply.status(400).send({ error: 'userId é obrigatório.' });
      }

      // Validar se o usuário pertence ao tenant
      const user = await prisma.user.findFirst({
        where: { id: targetUserId, tenantId }
      });

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado no tenant.' });
      }

      // Validar limites do plano
      const dbTenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true }
      });

      const limits = getPlanLimits(dbTenant?.plan);
      const currentKeysCount = await prisma.cliKey.count({
        where: { tenantId, isActive: true }
      });

      if (currentKeysCount >= limits.maxCliKeys) {
        return reply.status(429).send({
          error: `Limite de ${limits.maxCliKeys} chaves de CLI atingido para o plano ${dbTenant?.plan ?? 'STARTER'}. Faça upgrade para criar mais.`
        });
      }

      // Validar projeto (se informado)
      if (project) {
        const dbProject = await prisma.project.findFirst({
          where: { tenantId, name: project }
        });
        if (!dbProject) {
          return reply.status(400).send({ error: `Projeto '${project}' não está cadastrado no tenant.` });
        }
      }

      // Validar agente (se informado)
      if (agent) {
        const dbAgent = await prisma.agent.findFirst({
          where: { tenantId, name: agent }
        });
        if (!dbAgent) {
          return reply.status(400).send({ error: `Agente '${agent}' não está cadastrado no tenant.` });
        }
      }

      // Validar billingGroup (se informado)
      if (billingGroup) {
        const dbGroup = await prisma.billingGroup.findFirst({
          where: { tenantId, name: billingGroup }
        });
        if (!dbGroup) {
          return reply.status(400).send({ error: `Equipe/BillingGroup '${billingGroup}' não está cadastrado no tenant.` });
        }
      }

      const generatedKey = `qcli_${crypto.randomBytes(32).toString('hex')}`;

      const cliKey = await prisma.cliKey.create({
        data: {
          key: generatedKey,
          userId: targetUserId,
          tenantId,
          name,
          description: description ?? null,
          agent: agent ?? null,
          project: project ?? null,
          billingGroup: billingGroup ?? null,
          environment: environment ?? null,
          tags: Array.isArray(tags) ? tags : []
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      return reply.status(201).send({
        success: true,
        cliKey
      });
    } catch (error: any) {
      request.log.error(error);
      if (error.code === 'P2002') {
        return reply.status(400).send({ error: 'Já existe uma chave de CLI com esse nome para o usuário.' });
      }
      return reply.status(500).send({ error: 'Erro ao criar chave de CLI.' });
    }
  }

  async listCliKeys(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId ?? request.tenantId;
      if (!tenantId) return reply.status(403).send({ error: 'Tenant indisponível.' });

      const query = request.query as any;
      const userIdFilter = query?.userId;

      const keys = await prisma.cliKey.findMany({
        where: {
          tenantId,
          ...(userIdFilter ? { userId: userIdFilter } : {})
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({
        success: true,
        cliKeys: keys
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao listar chaves de CLI.' });
    }
  }

  async getCliKeyById(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId ?? request.tenantId;
      const { id } = request.params as any;

      const cliKey = await prisma.cliKey.findFirst({
        where: { id, tenantId },
        include: {
          user: { select: { id: true, name: true, email: true } }
        }
      });

      if (!cliKey) {
        return reply.status(404).send({ error: 'Chave de CLI não encontrada.' });
      }

      return reply.send({
        success: true,
        cliKey: {
          ...cliKey,
          key: `${cliKey.key.slice(0, 9)}...${cliKey.key.slice(-4)}`
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao buscar chave de CLI.' });
    }
  }

  async updateCliKey(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId ?? request.tenantId;
      const { id } = request.params as any;
      const body = request.body as any;

      const existing = await prisma.cliKey.findFirst({
        where: { id, tenantId }
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Chave de CLI não encontrada.' });
      }

      const updated = await prisma.cliKey.update({
        where: { id },
        data: {
          name: body.name ?? existing.name,
          description: body.description !== undefined ? body.description : existing.description,
          agent: body.agent !== undefined ? body.agent : existing.agent,
          project: body.project !== undefined ? body.project : existing.project,
          billingGroup: body.billingGroup !== undefined ? body.billingGroup : existing.billingGroup,
          environment: body.environment !== undefined ? body.environment : existing.environment,
          tags: body.tags !== undefined ? body.tags : existing.tags,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive
        }
      });

      return reply.send({
        success: true,
        cliKey: {
          ...updated,
          key: `${updated.key.slice(0, 9)}...${updated.key.slice(-4)}`
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao atualizar chave de CLI.' });
    }
  }

  async revokeCliKey(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId ?? request.tenantId;
      const { id } = request.params as any;

      const existing = await prisma.cliKey.findFirst({
        where: { id, tenantId }
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Chave de CLI não encontrada.' });
      }

      await prisma.cliKey.update({
        where: { id },
        data: { isActive: false }
      });

      return reply.send({
        success: true,
        message: 'Chave de CLI revogada com sucesso.'
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao revogar chave de CLI.' });
    }
  }

  async regenerateCliKey(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId ?? request.tenantId;
      const { id } = request.params as any;

      const existing = await prisma.cliKey.findFirst({
        where: { id, tenantId }
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Chave de CLI não encontrada.' });
      }

      const newGeneratedKey = `qcli_${crypto.randomBytes(32).toString('hex')}`;

      const updated = await prisma.cliKey.update({
        where: { id },
        data: {
          key: newGeneratedKey,
          isActive: true
        }
      });

      return reply.send({
        success: true,
        cliKey: updated
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao regenerar chave de CLI.' });
    }
  }
}
