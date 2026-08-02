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

  server.post(
    '/api-keys',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.generateApiKey
  );

  server.get(
    '/tenants/:tenantId/api-keys',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.listApiKeys
  );

  server.get(
    '/api-keys',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.listApiKeys
  );

  server.post(
    '/tenants/:tenantId/provider-credentials',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.createProviderCredential
  );

  server.post(
    '/provider-credentials',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.createProviderCredential
  );

  server.get(
    '/tenants/:tenantId/provider-credentials',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.listProviderCredentials
  );

  server.get(
    '/provider-credentials',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.listProviderCredentials
  );

  server.delete(
    '/tenants/:tenantId/provider-credentials/:id',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.deleteProviderCredential
  );

  server.delete(
    '/provider-credentials/:id',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.deleteProviderCredential
  );

  server.delete(
    '/tenants/:tenantId/api-keys/:id',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.deleteApiKey
  );

  server.delete(
    '/api-keys/:id',
    { preHandler: [authenticate, authorize('MANAGER')] },
    tenantController.deleteApiKey
  );
}