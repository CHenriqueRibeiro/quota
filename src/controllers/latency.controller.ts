import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";
import DashboardService from "../service/analytics/dashboard.service";

type LatencyQuery = {
  startDate?: string;
  endDate?: string;
};

export class LatencyController {
  async latency(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;

      if (!user || !user.tenantId) {
        return reply.status(401).send({
          error: "Tenant não encontrado"
        });
      }

      const query = request.query as LatencyQuery;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const startDate = query.startDate ? new Date(query.startDate) : startOfMonth;
      const endDate = query.endDate ? new Date(query.endDate) : now;

      const where = await ScopeService.buildWhere(user, startDate, endDate);
      const latencyData = await DashboardService.getLatency(where);

      return reply.send({
        latency: latencyData,
        period: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        message: "Erro ao buscar latência"
      });
    }
  }
}
