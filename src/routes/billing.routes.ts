import type { FastifyInstance } from 'fastify';
import BillingController from '../controllers/billing.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

export async function billingRoutes(server: FastifyInstance) {
  server.get('/tenants/:tenantId/billing-groups', { preHandler: [authenticate, authorize('MANAGER')] }, BillingController.list);
  server.post('/tenants/:tenantId/billing-groups', { preHandler: [authenticate, authorize('MANAGER')] }, BillingController.create);
}
