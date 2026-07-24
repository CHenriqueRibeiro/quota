import type { FastifyInstance } from "fastify";

import ScopeController from "../controllers/scope.controller";
import { authenticate } from "../middleware/auth.middleware";


const scopeController = new ScopeController();


export async function scopeRoutes(
  server: FastifyInstance
) {


  server.post(
    "/scopes",
    {
      preHandler:[
        authenticate
      ],
    },
    scopeController.create.bind(scopeController)
  );



  server.get(
    "/scopes/tenant/:tenantId",
    {
      preHandler:[
        authenticate
      ],
    },
    scopeController.list.bind(scopeController)
  );



  server.get(
    "/scopes/:id",
    {
      preHandler:[
        authenticate
      ],
    },
    scopeController.get.bind(scopeController)
  );



  server.put(
    "/scopes/:id",
    {
      preHandler:[
        authenticate
      ],
    },
    scopeController.update.bind(scopeController)
  );



  server.delete(
    "/scopes/:id",
    {
      preHandler:[
        authenticate
      ],
    },
    scopeController.delete.bind(scopeController)
  );



  server.put(
    "/scopes/assign-user",
    {
      preHandler:[
        authenticate
      ],
    },
    scopeController.assignUser.bind(scopeController)
  );

}