import type { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../middleware/auth.middleware";
import tagManagementController from "../controllers/tag-management.controller";

export async function tagManagementRoutes(server: FastifyInstance) {
  // List tags
  server.get(
    "/tags",
    { preHandler: [authenticate] },
    tagManagementController.list.bind(tagManagementController)
  );

  server.get(
    "/tenants/:tenantId/tags",
    { preHandler: [authenticate] },
    tagManagementController.list.bind(tagManagementController)
  );

  // Create tag
  server.post(
    "/tags",
    { preHandler: [authenticate, authorize("MANAGER")] },
    tagManagementController.create.bind(tagManagementController)
  );

  server.post(
    "/tenants/:tenantId/tags",
    { preHandler: [authenticate, authorize("MANAGER")] },
    tagManagementController.create.bind(tagManagementController)
  );

  // Update tag
  server.put(
    "/tags/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    tagManagementController.update.bind(tagManagementController)
  );

  server.put(
    "/tenants/:tenantId/tags/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    tagManagementController.update.bind(tagManagementController)
  );

  // Delete tag
  server.delete(
    "/tags/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    tagManagementController.delete.bind(tagManagementController)
  );

  server.delete(
    "/tenants/:tenantId/tags/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    tagManagementController.delete.bind(tagManagementController)
  );
}
