import type { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BillingController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = (request.params as any).tenantId as string;
    const groups = await prisma.billingGroup.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return reply.status(200).send(groups);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = (request.params as any).tenantId as string;
    const body = request.body as any;
    const name = body?.name;

    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
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
}

export default new BillingController();
