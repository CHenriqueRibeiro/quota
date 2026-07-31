import type { FastifyInstance } from "fastify";
import { FailedUsageController } from "../controllers/failedUsage.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const controller = new FailedUsageController();

export async function failedUsageRoutes(app: FastifyInstance) {
  app.get(
    "/failed-usage",
    { preHandler: [authenticate, authorize("MANAGER")] },
    controller.list.bind(controller)
  );

  app.get(
    "/failed-usage/tenant/:tenantId",
    { preHandler: [authenticate, authorize("MANAGER")] },
    controller.list.bind(controller)
  );

  app.post(
    "/failed-usage/:id/retry",
    { preHandler: [authenticate, authorize("MANAGER")] },
    controller.retry.bind(controller)
  );

  app.post(
    "/failed-usage/tenant/:tenantId/retry",
    { preHandler: [authenticate, authorize("MANAGER")] },
    controller.retryTenant.bind(controller)
  );

  app.post(
    "/failed-usage/retry",
    { preHandler: [authenticate, authorize("MANAGER")] },
    controller.retryTenant.bind(controller)
  );
}