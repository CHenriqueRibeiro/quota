import type { FastifyInstance } from "fastify";
import { authenticate, authorize } from "../middleware/auth.middleware";
import reportsController from "../controllers/reports.controller";

export async function reportsRoutes(server: FastifyInstance) {
  // Exportação CSV
  server.get(
    "/reports/export/detailed",
    { preHandler: [authenticate] },
    reportsController.exportDetailed.bind(reportsController)
  );

  server.post(
    "/reports/export/detailed",
    { preHandler: [authenticate] },
    reportsController.exportDetailed.bind(reportsController)
  );

  server.get(
    "/reports/export/overview",
    { preHandler: [authenticate] },
    reportsController.exportOverview.bind(reportsController)
  );

  server.post(
    "/reports/export/overview",
    { preHandler: [authenticate] },
    reportsController.exportOverview.bind(reportsController)
  );

  // Importação CSV
  server.post(
    "/reports/import/usage",
    { preHandler: [authenticate, authorize("MANAGER")] },
    reportsController.importUsage.bind(reportsController)
  );

  server.post(
    "/reports/import/users",
    { preHandler: [authenticate, authorize("MANAGER")] },
    reportsController.importUsers.bind(reportsController)
  );

  // Agendamento de Relatórios Recorrentes
  server.get(
    "/reports/schedules",
    { preHandler: [authenticate] },
    reportsController.listSchedules.bind(reportsController)
  );

  server.get(
    "/tenants/:tenantId/reports/schedules",
    { preHandler: [authenticate] },
    reportsController.listSchedules.bind(reportsController)
  );

  server.post(
    "/reports/schedules",
    { preHandler: [authenticate, authorize("MANAGER")] },
    reportsController.createSchedule.bind(reportsController)
  );

  server.post(
    "/tenants/:tenantId/reports/schedules",
    { preHandler: [authenticate, authorize("MANAGER")] },
    reportsController.createSchedule.bind(reportsController)
  );

  server.put(
    "/reports/schedules/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    reportsController.updateSchedule.bind(reportsController)
  );

  server.delete(
    "/reports/schedules/:id",
    { preHandler: [authenticate, authorize("MANAGER")] },
    reportsController.deleteSchedule.bind(reportsController)
  );

  server.post(
    "/reports/schedules/run",
    { preHandler: [authenticate, authorize("MANAGER")] },
    reportsController.runScheduleNow.bind(reportsController)
  );
}
