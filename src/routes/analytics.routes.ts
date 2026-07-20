import type { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/analytics.controller";
import { authenticate } from "../middleware/auth.middleware";

const analyticsController = new AnalyticsController();


type DashboardQuery = {
  startDate?: string;
  endDate?: string;
};


export async function analyticsRoutes(server: FastifyInstance) {

  server.get<{
    Querystring: DashboardQuery;
  }>(
    "/analytics/dashboard",
    {
      preHandler: [authenticate],
    },
    analyticsController.dashboard
  );

}