import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";
import DashboardService from "../service/analytics/dashboard.service";
import { parseBrasiliaStartDate, parseBrasiliaEndDate } from "../lib/timezone";

type DailyConsumptionQuery = {
  startDate?: string;
  endDate?: string;
};

export class DailyConsumptionController {
  async dailyConsumption(
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

      const query = request.query as DailyConsumptionQuery;
      const startDate = parseBrasiliaStartDate(query.startDate);
      const endDate = parseBrasiliaEndDate(query.endDate);

      const where = await ScopeService.buildWhere(user, startDate, endDate);
      const dailyConsumption = await DashboardService.getDailyConsumption(where);

      return reply.send({
        dailyConsumption,
        period: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        message: "Erro ao buscar consumo diário"
      });
    }
  }
}
