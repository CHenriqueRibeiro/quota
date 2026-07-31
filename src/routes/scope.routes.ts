import type { FastifyInstance } from "fastify";

import ScopeController from "../controllers/scope.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const scopeController = new ScopeController();

export async function scopeRoutes(
  server: FastifyInstance
) {

  server.post(
    "/scopes",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ],
    },
    scopeController.create.bind(scopeController)
  );

  server.get(
    "/scopes",
    {
      preHandler: [
        authenticate
      ],
    },
    scopeController.list.bind(scopeController)
  );

  server.get(
    "/scopes/tenant/:tenantId",
    {
      preHandler: [
        authenticate
      ],
    },
    scopeController.list.bind(scopeController)
  );

  server.get(
    "/scopes/:id",
    {
      preHandler: [
        authenticate
      ],
    },
    scopeController.get.bind(scopeController)
  );

  server.put(
    "/scopes/:id",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ],
    },
    scopeController.update.bind(scopeController)
  );

  server.delete(
    "/scopes/:id",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ],
    },
    scopeController.delete.bind(scopeController)
  );

  server.put(
    "/scopes/assign-user",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ],
    },
    scopeController.assignUser.bind(scopeController)
  );

}