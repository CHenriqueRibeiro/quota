import type { FastifyInstance } from 'fastify';
import { TenantController } from '../controllers/tenant.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const tenantController = new TenantController();

export async function tenantRoutes(server: FastifyInstance) {
  server.post('/tenants', tenantController.createTenant);

  server.post(
    '/tenants/:tenantId/api-keys',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.generateApiKey
  );

  server.get(
    '/tenants/:tenantId/api-keys',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.listApiKeys
  );

  server.post(
    '/tenants/:tenantId/provider-credentials',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.createProviderCredential
  );

  server.get(
    '/tenants/:tenantId/provider-credentials',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.listProviderCredentials
  );
}