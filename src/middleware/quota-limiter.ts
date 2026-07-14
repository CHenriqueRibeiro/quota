import { redis } from '../lib/redis';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';

export const quotaLimiter = (limit: number) => {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const tenantId = request.user?.tenantId ?? request.tenantId;

    if (!tenantId) {
      return reply.status(403).send({ error: 'Unauthorized: Tenant missing' });
    }

    const key = `quota:limit:${tenantId}`;
    const [_, currentUsage] = await redis
      .multi()
      .incr(key)
      .expire(key, 60)
      .exec() as [any, [any, number]];

    const count = Number(currentUsage[1]);

    if (count > limit) {
      return reply.status(429).send({ 
        error: 'Quota exceeded',
        retryAfter: '60s'
      });
    }

    reply.header('X-Quota-Limit', limit.toString());
    reply.header('X-Quota-Remaining', (limit - count).toString());
  };
};