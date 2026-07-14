import type { FastifyInstance } from 'fastify';
import { ProxyController } from '../controllers/proxy.controller';
import { validateApiKey } from '../middleware/api-key.middleware';
import { quotaLimiter } from '../middleware/quota-limiter';

const proxyController = new ProxyController();

export async function proxyRoutes(server: FastifyInstance) {
  server.post(
    '/proxy',
    { preHandler: [validateApiKey, quotaLimiter(100)] },
    proxyController.execute
  );
}
