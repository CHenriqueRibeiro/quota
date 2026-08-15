import type { FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";
import DashboardService from "../service/analytics/dashboard.service";

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
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const startDate = query.startDate ? new Date(query.startDate) : startOfMonth;
      const endDate = query.endDate ? new Date(query.endDate) : now;

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
