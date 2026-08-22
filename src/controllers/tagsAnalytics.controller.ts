import type { FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../types/auth";
import ScopeService from "../service/scope.service";

type TagsQuery = {
  startDate?: string;
  endDate?: string;
};

export class TagsAnalyticsController {
  async tags(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const user = request.user;
      if (!user || !user.tenantId) {
        return reply.status(401).send({ error: "Tenant não encontrado" });
      }

      const query = request.query as TagsQuery;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const startDate = query.startDate ? new Date(query.startDate) : startOfMonth;
      const endDate = query.endDate ? new Date(query.endDate) : now;

      const where = await ScopeService.buildWhere(user, startDate, endDate);

      const logs = await prisma.usageLog.findMany({
        where,
        select: {
          tags: true,
          totalTokens: true,
          estimatedCost: true,
        },
      });

      const map = new Map<string, { name: string; tagList: string[]; requests: number; tokens: number; cost: number }>();

      let totalRequests = 0;
      let totalTokens = 0;
      let totalCost = 0;

      for (const log of logs) {
        totalRequests += 1;
        totalTokens += log.totalTokens || 0;
        totalCost += Number(log.estimatedCost || 0);

        let tagList: string[] = [];
        if (Array.isArray(log.tags)) {
          tagList = log.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
        } else if (typeof log.tags === "string" && log.tags.trim().length > 0) {
          tagList = [log.tags.trim()];
        }

        // Ordena as tags para manter agrupamento uniforme
        const sortedTags = [...tagList].sort();
        const groupKey = sortedTags.length > 0 ? sortedTags.join(", ") : "Sem tag";

        const current = map.get(groupKey) || {
          name: groupKey,
          tagList: sortedTags.length > 0 ? sortedTags : ["Sem tag"],
          requests: 0,
          tokens: 0,
          cost: 0,
        };

        current.requests += 1;
        current.tokens += log.totalTokens || 0;
        current.cost += Number(log.estimatedCost || 0);
        map.set(groupKey, current);
      }

      const tags = Array.from(map.values())
        .sort((a, b) => b.cost - a.cost || b.requests - a.requests);

      return reply.send({
        tags,
        summary: {
          totalRequests,
          totalTokens,
          totalCost,
        },
        period: {
          startDate,
          endDate,
        },
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        message: "Erro ao buscar analytics de tags",
      });
    }
  }
}

export default new TagsAnalyticsController();
