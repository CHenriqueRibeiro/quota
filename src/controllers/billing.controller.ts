import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../types/auth';
import { getPlanLimits } from '../config/plan-limits';

export class BillingController {

  async list(request: FastifyRequest, reply: FastifyReply) {
    const actor = (request as AuthenticatedRequest).user;
    const paramTenantId = (request.params as any)?.tenantId;
    const queryTenantId = (request.query as any)?.tenantId;
    const tenantId = paramTenantId || queryTenantId || actor?.tenantId;

    if (!tenantId) {
      return reply.status(400).send({ error: 'tenantId is required' });
    }

    if (actor && actor.role !== 'ADMIN' && actor.tenantId !== tenantId) {
      return reply.status(403).send({ error: 'Sem permissão para este tenant' });
    }

    const groups = await prisma.billingGroup.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return reply.status(200).send(groups);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const actor = (request as AuthenticatedRequest).user;
    const body = request.body as any;
    const paramTenantId = (request.params as any)?.tenantId;
    const bodyTenantId = body?.tenantId;
    const tenantId = paramTenantId || bodyTenantId || actor?.tenantId;
    const name = body?.name;

    if (!tenantId) {
      return reply.status(400).send({ error: 'tenantId is required' });
    }

    if (actor && actor.role !== 'ADMIN' && actor.tenantId !== tenantId) {
      return reply.status(403).send({ error: 'Sem permissão para este tenant' });
    }

    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
    const currentGroupCount = await prisma.billingGroup.count({ where: { tenantId } });
    const limits = getPlanLimits(tenant?.plan);
    if (currentGroupCount >= limits.maxBillingGroups) {
      return reply.status(403).send({
        error: `Limite de ${limits.maxBillingGroups} grupo(s) de faturamento atingido para o plano ${tenant?.plan ?? 'STARTER'}. Faça upgrade para adicionar mais grupos.`
      });
    }

    try {

      const group = await prisma.billingGroup.create({ data: { tenantId, name } });
      return reply.status(201).send(group);
    } catch (err: any) {
      request.log.error({ err }, 'failed creating billing group');

      if (err.code === 'P2002') {
        return reply.status(409).send({
          error: 'Billing group already exists'
        });
      }

      return reply.status(500).send({
        error: 'failed to create billing group'
      });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const actor = (request as AuthenticatedRequest).user;
    const params = request.params as any;
    const id = params?.id;
    const paramTenantId = params?.tenantId;
    const tenantId = paramTenantId || actor?.tenantId;

    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'id is required' });
    }

    try {
      const group = await prisma.billingGroup.findFirst({
        where: {
          id,
          ...(tenantId && actor?.role !== 'ADMIN' ? { tenantId } : {})
        }
      });

      if (!group) {
        return reply.status(404).send({ error: 'Billing group not found' });
      }

      if (actor && actor.role !== 'ADMIN' && actor.tenantId !== group.tenantId) {
        return reply.status(403).send({ error: 'Sem permissão para este tenant' });
      }

      await prisma.billingGroup.delete({
        where: { id: group.id }
      });

      return reply.status(200).send({ message: 'Billing group deleted successfully' });
    } catch (err: any) {
      request.log.error({ err }, 'failed deleting billing group');
      return reply.status(500).send({ error: 'failed to delete billing group' });
    }
  }
}

export default new BillingController();
