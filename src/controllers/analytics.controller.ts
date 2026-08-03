import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";


import DashboardService from "../service/analytics/dashboard.service";

type DashboardQuery = {
  startDate?: string;
  endDate?: string;
};

export class AnalyticsController {

  async dashboard(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {

  try {

    const query = request.query as DashboardQuery;

    const tenantId = request.user?.tenantId;
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        message: "Usuário não autenticado."
      });
    }

    if (!tenantId) {
      return reply.status(401).send({
        message: "Tenant não identificado."
      });
    }

    const now = new Date();

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const startDate = query.startDate
      ? new Date(query.startDate)
      : startOfMonth;

    let endDate = now;
    if (query.endDate) {
      endDate = new Date(query.endDate);
      if (query.endDate.length <= 10) {
        endDate.setUTCHours(23, 59, 59, 999);
      }
    }

    const where =
      await ScopeService.buildWhere(
        user,
        startDate,
        endDate
      );

    const summary =
  await DashboardService.getSummary(
    where,
    startDate,
    endDate
  );

const providers =
  await DashboardService.getProviders(where);

const models =
  await DashboardService.getModels(where);

const projects =
  await DashboardService.getProjects(where);

const agents =
  await DashboardService.getAgents(where);

const tags =
  await DashboardService.getTags(where);

const users =
  await DashboardService.getUsers(where);

const billingGroups =
  await DashboardService.getBillingGroups(where);

const dailyConsumption =
  await DashboardService.getDailyConsumption(where);

const latency =
  await DashboardService.getLatency(where);

const errors =
  await DashboardService.getErrors(where);

const jobs =
  await DashboardService.getJobs(
    where,
    tenantId,
    startDate,
    endDate
);

return reply.send({
  summary,
  providers,
  models,
  projects,
  billingGroups,
  users,
  agents,
  tags,
  dailyConsumption,
  latency,
  errors,
  jobs,
});

  } catch (error) {

    console.error(error);

    if (
      error instanceof Error &&
      error.message === "Usuário não possui Scope."
    ) {

      return reply.status(403).send({
        message: "Usuário sem permissão de acesso ao dashboard."
      });

    }

    if (
      error instanceof Error &&
      error.message === "Scope CUSTOM sem regras configuradas."
    ) {

      return reply.status(403).send({
        message: "Scope sem regras configuradas."
      });

    }

    return reply.status(500).send({
      message: "Erro ao gerar dashboard."
    });

  }

}
}