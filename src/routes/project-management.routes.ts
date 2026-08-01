import type { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../middleware/auth.middleware";
import projectManagementController from "../controllers/project-management.controller";

export async function projectManagementRoutes(server: FastifyInstance) {
  // Lista projetos
  server.get(
    "/projects",
    { preHandler: [authenticate] },
    projectManagementController.list.bind(projectManagementController)
  );

  server.get(
    "/tenants/:tenantId/projects",
    { preHandler: [authenticate] },
    projectManagementController.list.bind(projectManagementController)
  );

  // Cria projeto
  server.post(
    "/projects",
    { preHandler: [authenticate, authorize("MANAGER")] },
    projectManagementController.create.bind(projectManagementController)
  );

  server.post(
    "/tenants/:tenantId/projects",
    { preHandler: [authenticate, authorize("MANAGER")] },
    projectManagementController.create.bind(projectManagementController)
  );

  // Deleta projeto
  server.delete(
    "/projects/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    projectManagementController.delete.bind(projectManagementController)
  );

  server.delete(
    "/tenants/:tenantId/projects/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    projectManagementController.delete.bind(projectManagementController)
  );
}
