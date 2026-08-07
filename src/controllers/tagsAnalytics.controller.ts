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

      const map = new Map<string, { requests: number; tokens: number; cost: number }>();

      for (const log of logs) {
        let tagList: string[] = [];
        if (Array.isArray(log.tags)) {
          tagList = log.tags.filter((t): t is string => typeof t === "string");
        } else if (typeof log.tags === "string") {
          tagList = [log.tags];
        } else {
          tagList = ["Sem tag"];
        }

        if (tagList.length === 0) tagList = ["Sem tag"];

        for (const tagName of tagList) {
          const current = map.get(tagName) || { requests: 0, tokens: 0, cost: 0 };
          current.requests += 1;
          current.tokens += log.totalTokens || 0;
          current.cost += Number(log.estimatedCost || 0);
          map.set(tagName, current);
        }
      }

      const tags = Array.from(map.entries())
        .map(([name, stats]) => ({
          name,
          requests: stats.requests,
          tokens: stats.tokens,
          cost: stats.cost,
        }))
        .sort((a, b) => b.tokens - a.tokens);

      return reply.send({
        tags,
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
