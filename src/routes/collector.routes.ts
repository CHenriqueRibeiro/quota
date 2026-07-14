import type { FastifyInstance } from 'fastify';
import { CollectorController } from '../controllers/collector.controller';
import { validateApiKey } from '../middleware/api-key.middleware';
import { quotaLimiter } from '../middleware/quota-limiter';

const collectorController = new CollectorController();

export async function collectorRoutes(server: FastifyInstance) {
  server.post(
    '/collector',
    { 
      preHandler: [
        validateApiKey,
        quotaLimiter(100)
      ] 
    },
    collectorController.execute
  );
}