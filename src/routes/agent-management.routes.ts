import type { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../middleware/auth.middleware";
import agentManagementController from "../controllers/agent-management.controller";

export async function agentManagementRoutes(server: FastifyInstance) {
  // Lista agentes
  server.get(
    "/agents-management",
    { preHandler: [authenticate] },
    agentManagementController.list.bind(agentManagementController)
  );

  server.get(
    "/tenants/:tenantId/agents-management",
    { preHandler: [authenticate] },
    agentManagementController.list.bind(agentManagementController)
  );

  // Cria agente
  server.post(
    "/agents-management",
    { preHandler: [authenticate, authorize("MANAGER")] },
    agentManagementController.create.bind(agentManagementController)
  );

  server.post(
    "/tenants/:tenantId/agents-management",
    { preHandler: [authenticate, authorize("MANAGER")] },
    agentManagementController.create.bind(agentManagementController)
  );

  // Deleta agente
  server.delete(
    "/agents-management/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    agentManagementController.delete.bind(agentManagementController)
  );

  server.delete(
    "/tenants/:tenantId/agents-management/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    agentManagementController.delete.bind(agentManagementController)
  );
}
