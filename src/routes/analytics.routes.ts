import type { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/analytics.controller";
import { OverviewController } from "../controllers/overview.controller";
import { authenticate } from "../middleware/auth.middleware";
import { ProvidersAnalyticsController } from "../controllers/providersAnalitycs.controller";
import { ModelsAnalyticsController } from "../controllers/modelsAnalytics.controller";
import { AnalyticsBillingController } from "../controllers/billingAnalytics.controller";
import { AnalyticsProjectsController } from "../controllers/projects.controller";
import { AnalyticsUsersController } from "../controllers/usersAnalytics.controller";
import { AgentsController } from "../controllers/agents.controller";
import { DailyConsumptionController } from "../controllers/dailyConsumption.controller";
import { LatencyController } from "../controllers/latency.controller";
import { JobsController } from "../controllers/jobs.controller";
import tagsAnalyticsController from "../controllers/tagsAnalytics.controller";
import { BIController } from "../controllers/bi.controller";
import { BIReportController } from "../controllers/bi-report.controller";

const jobsController = new JobsController();
const latencyController = new LatencyController();
const dailyConsumptionController = new DailyConsumptionController();
const agentsController = new AgentsController();
const analyticsUsersController = new AnalyticsUsersController();
const analyticsProjectsController = new AnalyticsProjectsController();
const analyticsBillingController = new AnalyticsBillingController();
const analyticsController = new AnalyticsController();
const overviewController = new OverviewController();
const providersAnalyticsController = new ProvidersAnalyticsController();
const modelsAnalyticsController = new ModelsAnalyticsController();
const biController = new BIController();
const biReportController = new BIReportController();



type DashboardQuery = {

  startDate?: string;

  endDate?: string;

};



type OverviewQuery = {

  startDate?: string;

  endDate?: string;

};



export async function analyticsRoutes(
  server: FastifyInstance
) {


  server.get<{
    Querystring: DashboardQuery;
  }>(
    "/analytics/dashboard",
    {
      preHandler: [
        authenticate
      ],
    },
    analyticsController.dashboard
  );



  server.get<{
    Querystring: OverviewQuery;
  }>(
    "/analytics/overview",
    {
      preHandler: [
        authenticate
      ]
    },
    overviewController.overview
  );

  server.get(
    "/analytics/providers",
    {
      preHandler: [
        authenticate
      ]
    },
    providersAnalyticsController.providers
  );

  server.get(
    "/analytics/models",
    {
      preHandler: [
        authenticate
      ]
    },
    modelsAnalyticsController.models
  );

  server.get(
    "/analytics/billing-groups",
    {
      preHandler: [
        authenticate
      ]
    },
    analyticsBillingController.billingGroups
  );

  server.get(
    "/analytics/projects",
    {
      preHandler: [
        authenticate
      ]
    },
    analyticsProjectsController.projects
  );

  server.get(
    "/analytics/users",
    {
      preHandler: [
        authenticate
      ]
    },
    analyticsUsersController.users
  );


  server.get(
    "/analytics/agents",
    {
      preHandler: [
        authenticate
      ]
    },
    agentsController.agents
  );




  server.get(
    "/analytics/daily-consumption",
    {
      preHandler: [
        authenticate
      ]
    },
    dailyConsumptionController.dailyConsumption
  );




  server.get(
    "/analytics/latency",
    {
      preHandler: [
        authenticate
      ]
    },
    latencyController.latency
  );





  server.get(
    "/analytics/jobs",
    {
      preHandler: [
        authenticate
      ]
    },
    jobsController.jobs
  );

  server.get(
    "/analytics/tags",
    {
      preHandler: [
        authenticate
      ]
    },
    tagsAnalyticsController.tags.bind(tagsAnalyticsController)
  );

  server.get(
    "/analytics/logs",
    {
      preHandler: [
        authenticate
      ]
    },
    analyticsController.logs
  );

  server.get(
    "/analytics/bi/catalog",
    {
      preHandler: [
        authenticate
      ]
    },
    biController.getCatalog
  );

  server.post(
    "/analytics/bi/query",
    {
      preHandler: [
        authenticate
      ]
    },
    biController.executeQuery
  );

  server.get(
    "/analytics/bi/reports",
    { preHandler: [authenticate] },
    biReportController.listReports.bind(biReportController)
  );

  server.get(
    "/analytics/bi/reports/:id",
    { preHandler: [authenticate] },
    biReportController.getReportById.bind(biReportController)
  );

  server.post(
    "/analytics/bi/reports",
    { preHandler: [authenticate] },
    biReportController.saveReport.bind(biReportController)
  );

  server.delete(
    "/analytics/bi/reports/:id",
    { preHandler: [authenticate] },
    biReportController.deleteReport.bind(biReportController)
  );
}