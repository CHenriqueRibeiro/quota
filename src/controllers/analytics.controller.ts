import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";


import DashboardService from "../service/analytics/dashboard.service";

type DashboardQuery = {
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
  provider?: string;
  model?: string;
  success?: string;
  project?: string;
  agent?: string;
  search?: string;
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

    let successFilter: boolean | undefined = undefined;
    if (query.success !== undefined) {
      if (query.success === "true") successFilter = true;
      if (query.success === "false") successFilter = false;
    }

    const [
      summary,
      providers,
      models,
      projects,
      agents,
      tags,
      users,
      billingGroups,
      dailyConsumption,
      latency,
      errors,
      jobs,
      logs
    ] = await Promise.all([
      DashboardService.getSummary(where, startDate, endDate),
      DashboardService.getProviders(where),
      DashboardService.getModels(where),
      DashboardService.getProjects(where),
      DashboardService.getAgents(where),
      DashboardService.getTags(where),
      DashboardService.getUsers(where),
      DashboardService.getBillingGroups(where),
      DashboardService.getDailyConsumption(where),
      DashboardService.getLatency(where),
      DashboardService.getErrors(where),
      DashboardService.getJobs(where, tenantId, startDate, endDate),
      DashboardService.getPaginatedLogs(where, {
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        provider: query.provider,
        model: query.model,
        success: successFilter,
        project: query.project,
        agent: query.agent,
        search: query.search,
      })
    ]);

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
      logs,
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

  async logs(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const query = request.query as LogsQuery;
      const user = request.user;
      const tenantId = user?.tenantId;

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

      const where = await ScopeService.buildWhere(
        user,
        startDate,
        endDate
      );

      let successFilter: boolean | undefined = undefined;
      if (query.success !== undefined) {
        if (query.success === "true") successFilter = true;
        if (query.success === "false") successFilter = false;
      }

      const result = await DashboardService.getPaginatedLogs(where, {
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        provider: query.provider,
        model: query.model,
        success: successFilter,
        project: query.project,
        agent: query.agent,
        environment: query.environment,
        search: query.search,
      });

      return reply.send(result);
    } catch (error) {
      console.error("Erro ao buscar logs paginados:", error);

      if (
        error instanceof Error &&
        (error.message === "Usuário não possui Scope." ||
          error.message === "Scope CUSTOM sem regras configuradas.")
      ) {
        return reply.status(403).send({
          message: error.message
        });
      }

      return reply.status(500).send({
        message: "Erro ao buscar logs paginados."
      });
    }
  }

  async queryBI(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const user = request.user;
      if (!user || !user.tenantId) {
        return reply.status(401).send({ message: "Usuário ou tenant não identificado." });
      }

      const body = (request.body || {}) as {
        startDate?: string;
        endDate?: string;
        dimension?: string;
        environment?: string;
      };

      const now = new Date();
      const startDate = body.startDate ? new Date(body.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      let endDate = now;
      if (body.endDate) {
        endDate = new Date(body.endDate);
        if (body.endDate.length <= 10) endDate.setUTCHours(23, 59, 59, 999);
      }

      const where = await ScopeService.buildWhere(user, startDate, endDate);
      if (body.environment && body.environment !== 'all') {
        (where as any).environment = body.environment;
      }

      const dimension = body.dimension || "provider";
      const data = await DashboardService.queryBI(where, dimension);

      return reply.send({ dimension, data });
    } catch (error) {
      console.error("Erro na rota queryBI:", error);
      return reply.status(500).send({ message: "Erro ao processar consulta de BI." });
    }
  }
}

type LogsQuery = {
  page?: string;
  limit?: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
  model?: string;
  success?: string;
  project?: string;
  agent?: string;
  environment?: string;
  search?: string;
};