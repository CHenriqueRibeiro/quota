import type { FastifyInstance } from 'fastify';
import { auditController } from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth.middleware';

export async function auditRoutes(server: FastifyInstance) {
  server.get(
    '/audit-logs',
    { preHandler: [authenticate] },
    auditController.listLogs.bind(auditController)
  );

  server.get(
    '/audit-logs/stats',
    { preHandler: [authenticate] },
    auditController.getStats.bind(auditController)
  );

  server.get(
    '/audit-logs/categories',
    { preHandler: [authenticate] },
    auditController.getCategories.bind(auditController)
  );

  server.get(
    '/audit/logs',
    { preHandler: [authenticate] },
    auditController.listLogs.bind(auditController)
  );

  server.post(
    '/audit-logs',
    { preHandler: [authenticate] },
    auditController.createLog.bind(auditController)
  );
}
