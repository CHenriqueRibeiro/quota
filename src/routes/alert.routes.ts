import type { FastifyInstance } from "fastify";
import AlertController from "../controllers/alert.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";


export async function alertRoutes(server: FastifyInstance) {

  server.post(
    "/alerts",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ]
    },
    AlertController.create
  );


  server.get(
    "/alerts/tenants/:tenantId",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ]
    },
    AlertController.list
  );



  server.post(
    "/alerts/process/:tenantId",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ]
    },
    AlertController.process
  );



  server.post(
    "/alerts/test/:alertConfigId",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ]
    },
    AlertController.test
  );



  server.get(
    "/alerts/notifications/:tenantId",
    {
      preHandler: [
        authenticate,
        authorize("MANAGER")
      ]
    },
    AlertController.notifications
  );


}