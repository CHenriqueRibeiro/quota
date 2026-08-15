import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { usageQueue } from "../../lib/queue";

export function buildUsageLogSqlWhere(where: Prisma.UsageLogWhereInput): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (where.tenantId) {
    conditions.push(Prisma.sql`"tenantId" = ${where.tenantId as string}`);
  }

  if (where.createdAt) {
    const c = where.createdAt as any;
    if (c.gte) conditions.push(Prisma.sql`"createdAt" >= ${new Date(c.gte)}`);
    if (c.gt) conditions.push(Prisma.sql`"createdAt" > ${new Date(c.gt)}`);
    if (c.lte) conditions.push(Prisma.sql`"createdAt" <= ${new Date(c.lte)}`);
    if (c.lt) conditions.push(Prisma.sql`"createdAt" < ${new Date(c.lt)}`);
  }

  if (where.provider) {
    if (typeof where.provider === 'string') {
      conditions.push(Prisma.sql`"provider" = ${where.provider as any}`);
    } else if ((where.provider as any)?.in && Array.isArray((where.provider as any).in)) {
      conditions.push(Prisma.sql`"provider" IN (${Prisma.join((where.provider as any).in.map((p: any) => Prisma.sql`${p}`))})`);
    }
  }

  if (where.model) {
    if (typeof where.model === 'string') {
      conditions.push(Prisma.sql`"model" = ${where.model}`);
    } else if ((where.model as any)?.in && Array.isArray((where.model as any).in)) {
      conditions.push(Prisma.sql`"model" IN (${Prisma.join((where.model as any).in.map((m: any) => Prisma.sql`${m}`))})`);
    }
  }

  if (where.project) {
    if (typeof where.project === 'string') {
      conditions.push(Prisma.sql`"project" = ${where.project}`);
    } else if ((where.project as any)?.in && Array.isArray((where.project as any).in)) {
      conditions.push(Prisma.sql`"project" IN (${Prisma.join((where.project as any).in.map((p: any) => Prisma.sql`${p}`))})`);
    }
  }

  if (where.agent) {
    if (typeof where.agent === 'string') {
      conditions.push(Prisma.sql`"agent" = ${where.agent}`);
    } else if ((where.agent as any)?.in && Array.isArray((where.agent as any).in)) {
      conditions.push(Prisma.sql`"agent" IN (${Prisma.join((where.agent as any).in.map((a: any) => Prisma.sql`${a}`))})`);
    }
  }

  if (where.environment) {
    if (typeof where.environment === 'string') {
      conditions.push(Prisma.sql`"environment" = ${where.environment}`);
    } else if ((where.environment as any)?.in && Array.isArray((where.environment as any).in)) {
      conditions.push(Prisma.sql`"environment" IN (${Prisma.join((where.environment as any).in.map((e: any) => Prisma.sql`${e}`))})`);
    }
  }

  if (where.billingGroupId) {
    if (typeof where.billingGroupId === 'string') {
      conditions.push(Prisma.sql`"billingGroupId" = ${where.billingGroupId}`);
    } else if ((where.billingGroupId as any)?.in && Array.isArray((where.billingGroupId as any).in)) {
      conditions.push(Prisma.sql`"billingGroupId" IN (${Prisma.join((where.billingGroupId as any).in.map((b: any) => Prisma.sql`${b}`))})`);
    }
  }

  if (where.billingGroup && (where.billingGroup as any)?.name?.in) {
    const bgNames = (where.billingGroup as any).name.in;
    if (Array.isArray(bgNames) && bgNames.length > 0) {
      conditions.push(Prisma.sql`"billingGroupId" IN (SELECT id FROM "billing_groups" WHERE name IN (${Prisma.join(bgNames.map((n: any) => Prisma.sql`${n}`))}))`);
    }
  }

  if (typeof where.success === 'boolean') {
    conditions.push(Prisma.sql`"success" = ${where.success}`);
  }

  if (conditions.length === 0) {
    return Prisma.sql`WHERE 1=1`;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

export default class DashboardService {
  static async getSummary(
    where: Prisma.UsageLogWhereInput,
    startDate: Date,
    endDate: Date
  ) {
    const usage = await prisma.usageLog.aggregate({
      where,
      _count: { id: true },
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        estimatedCost: true,
      },
      _avg: { latencyMs: true },
    });

    return {
      requests: usage._count.id,
      tokens: {
        total: usage._sum.totalTokens ?? 0,
        input: usage._sum.promptTokens ?? 0,
        output: usage._sum.completionTokens ?? 0,
      },
      costs: {
        total: Number(usage._sum.estimatedCost ?? 0),
        currency: "BRL",
      },
      latency: {
        averageMs: Math.round(Number(usage._avg.latencyMs ?? 0)),
      },
      period: { startDate, endDate },
    };
  }

  static async getProviders(where: Prisma.UsageLogWhereInput) {
    const providersRaw = await prisma.usageLog.groupBy({
      where,
      by: ["provider"],
      _sum: { totalTokens: true, estimatedCost: true },
      _count: { id: true },
    });

    return providersRaw.map((item) => ({
      name: item.provider,
      requests: item._count.id,
      tokens: item._sum.totalTokens ?? 0,
      cost: Number(item._sum.estimatedCost ?? 0),
    }));
  }

  static async getModels(where: Prisma.UsageLogWhereInput) {
    const modelsRaw = await prisma.usageLog.groupBy({
      where,
      by: ["model"],
      _sum: { totalTokens: true, estimatedCost: true },
      _count: { id: true },
    });

    return modelsRaw.map((item) => ({
      name: item.model,
      requests: item._count.id,
      tokens: item._sum.totalTokens ?? 0,
      cost: Number(item._sum.estimatedCost ?? 0),
    }));
  }

  static async getProjects(where: Prisma.UsageLogWhereInput) {
    const projectsRaw = await prisma.usageLog.groupBy({
      where,
      by: ["project"],
      _sum: { totalTokens: true, estimatedCost: true },
      _count: { id: true },
    });

    return projectsRaw
      .filter((item) => item.project)
      .map((item) => ({
        name: item.project,
        requests: item._count.id,
        tokens: item._sum.totalTokens ?? 0,
        cost: Number(item._sum.estimatedCost ?? 0),
      }));
  }

  static async getAgents(where: Prisma.UsageLogWhereInput) {
    const agentsRaw = await prisma.usageLog.groupBy({
      where,
      by: ["agent"],
      _sum: { totalTokens: true, estimatedCost: true },
      _count: { id: true },
    });

    return agentsRaw
      .filter((item) => item.agent)
      .map((item) => ({
        name: item.agent,
        requests: item._count.id,
        tokens: item._sum.totalTokens ?? 0,
        cost: Number(item._sum.estimatedCost ?? 0),
      }));
  }

  static async getTags(where: Prisma.UsageLogWhereInput) {
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

    return Array.from(map.entries())
      .map(([name, stats]) => ({
        name,
        requests: stats.requests,
        tokens: stats.tokens,
        cost: stats.cost,
      }))
      .sort((a, b) => b.tokens - a.tokens);
  }

  static async getBillingGroups(where: Prisma.UsageLogWhereInput) {
    const billingGroupsRaw = await prisma.usageLog.groupBy({
      where,
      by: ["billingGroupId"],
      _sum: { totalTokens: true, estimatedCost: true },
      _count: { id: true },
    });

    const validGroups = billingGroupsRaw.filter((item) => item.billingGroupId);
    const billingGroupIds = validGroups.map((item) => item.billingGroupId as string);

    const billingGroups = await prisma.billingGroup.findMany({
      where: { id: { in: billingGroupIds } },
      select: { id: true, name: true },
    });

    const billingGroupMap = new Map<string, string>();
    for (const bg of billingGroups) {
      billingGroupMap.set(bg.id, bg.name);
    }

    return validGroups.map((item) => ({
      name: billingGroupMap.get(item.billingGroupId as string) || "Grupo Desconhecido",
      requests: item._count.id,
      tokens: item._sum.totalTokens ?? 0,
      cost: Number(item._sum.estimatedCost ?? 0),
    }));
  }

  static async getUsers(where: Prisma.UsageLogWhereInput) {
    const usersRaw = await prisma.usageLog.groupBy({
      where,
      by: ["externalUserId"],
      _sum: { totalTokens: true, estimatedCost: true },
      _count: { id: true },
    });

    return usersRaw
      .filter((item) => item.externalUserId)
      .map((item) => ({
        name: item.externalUserId,
        requests: item._count.id,
        tokens: item._sum.totalTokens ?? 0,
        cost: Number(item._sum.estimatedCost ?? 0),
      }));
  }

  static async getDailyConsumption(where: Prisma.UsageLogWhereInput) {
    const whereSql = buildUsageLogSqlWhere(where);
    const rows = await prisma.$queryRaw<Array<{ date: string; requests: number; tokens: number; cost: number }>>`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS date,
        COUNT(id)::int AS requests,
        COALESCE(SUM("totalTokens"), 0)::int AS tokens,
        COALESCE(SUM("estimatedCost"), 0)::float AS cost
      FROM "usage_logs"
      ${whereSql}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((r) => ({
      date: r.date,
      requests: Number(r.requests || 0),
      tokens: Number(r.tokens || 0),
      cost: Number(r.cost || 0),
    }));
  }

  static async getLatency(where: Prisma.UsageLogWhereInput) {
    const whereSql = buildUsageLogSqlWhere(where);
    const rows = await prisma.$queryRaw<Array<{ average: number; p50: number; p95: number; p99: number }>>`
      SELECT 
        COALESCE(ROUND(AVG("latencyMs")), 0)::int AS average,
        COALESCE(ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "latencyMs")), 0)::int AS p50,
        COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "latencyMs")), 0)::int AS p95,
        COALESCE(ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "latencyMs")), 0)::int AS p99
      FROM "usage_logs"
      ${whereSql}
        AND "latencyMs" IS NOT NULL
    `;

    const stat = rows[0] || { average: 0, p50: 0, p95: 0, p99: 0 };
    return {
      average: Number(stat.average || 0),
      p50: Number(stat.p50 || 0),
      p95: Number(stat.p95 || 0),
      p99: Number(stat.p99 || 0),
    };
  }

  static async getErrors(where: Prisma.UsageLogWhereInput) {
    const errorsRaw = await prisma.usageLog.groupBy({
      where,
      by: ["statusCode"],
      _count: { id: true },
    });

    return {
      success: errorsRaw
        .filter((e) => e.statusCode && e.statusCode >= 200 && e.statusCode < 300)
        .reduce((a, b) => a + b._count.id, 0),
      clientErrors: errorsRaw
        .filter((e) => e.statusCode && e.statusCode >= 400 && e.statusCode < 500)
        .reduce((a, b) => a + b._count.id, 0),
      serverErrors: errorsRaw
        .filter((e) => e.statusCode && e.statusCode >= 500)
        .reduce((a, b) => a + b._count.id, 0),
    };
  }

  static async getJobs(
    where: Prisma.UsageLogWhereInput,
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    const [
      pendingJobs,
      activeJobs,
      failedJobs,
      processedJobs,
      averageProcessing,
      retries,
    ] = await Promise.all([
      usageQueue.getWaitingCount(),
      usageQueue.getActiveCount(),
      prisma.failedUsage.count({
        where: {
          tenantId,
          lastAttemptAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.usageLog.count({ where }),
      prisma.usageLog.aggregate({
        where,
        _avg: { latencyMs: true },
      }),
      prisma.failedUsage.aggregate({
        where: {
          tenantId,
          lastAttemptAt: { gte: startDate, lte: endDate },
        },
        _sum: { attempts: true },
      }),
    ]);

    const errorRate =
      processedJobs > 0
        ? Number(((failedJobs / processedJobs) * 100).toFixed(2))
        : 0;

    return {
      processed: processedJobs,
      pending: pendingJobs,
      active: activeJobs,
      failed: failedJobs,
      errorRate: `${errorRate}%`,
      averageProcessingTimeMs: Math.round(
        Number(averageProcessing._avg.latencyMs ?? 0)
      ),
      retries: retries._sum?.attempts ?? 0,
    };
  }

  static async getPaginatedLogs(
    baseWhere: Prisma.UsageLogWhereInput,
    options: {
      page?: number;
      limit?: number;
      provider?: string;
      model?: string;
      success?: boolean;
      project?: string;
      agent?: string;
      environment?: string;
      search?: string;
    }
  ) {
    const page = Math.max(1, Number(options.page) || 1);
    const rawLimit = Number(options.limit) || 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const where: Prisma.UsageLogWhereInput = {
      ...baseWhere,
    };

    if (options.provider) {
      where.provider = options.provider as any;
    }
    if (options.model) {
      where.model = { contains: options.model, mode: "insensitive" };
    }
    if (typeof options.success === "boolean") {
      where.success = options.success;
    }
    if (options.project) {
      where.project = options.project;
    }
    if (options.agent) {
      where.agent = options.agent;
    }
    if (options.environment) {
      where.environment = options.environment;
    }
    if (options.search) {
      const search = options.search.trim().slice(0, 100);
      where.OR = [
        { traceId: { contains: search, mode: "insensitive" } },
        { requestId: { contains: search, mode: "insensitive" } },
        { externalUserId: { contains: search, mode: "insensitive" } },
        { agent: { contains: search, mode: "insensitive" } },
        { project: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.usageLog.count({ where }),
      prisma.usageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          billingGroup: { select: { id: true, name: true } },
          apiKey: { select: { id: true, name: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  static async queryBI(where: Prisma.UsageLogWhereInput, dimension: string = "provider") {
    const validDimensions = [
      "provider",
      "model",
      "agent",
      "project",
      "environment",
      "billingGroupId",
      "externalUserId",
    ];

    const groupByField = validDimensions.includes(dimension) ? (dimension as any) : "provider";

    const aggregated = await prisma.usageLog.groupBy({
      where,
      by: [groupByField],
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        estimatedCost: true,
      },
      _avg: {
        latencyMs: true,
      },
      _count: {
        id: true,
      },
    });

    return aggregated.map((item) => {
      const reqCount = item._count.id || 0;
      const totalCost = Number(item._sum.estimatedCost ?? 0);
      const totalToks = item._sum.totalTokens ?? 0;

      return {
        name: String(item[groupByField] || "Outros"),
        requests: reqCount,
        tokens: totalToks,
        inputTokens: item._sum.promptTokens ?? 0,
        outputTokens: item._sum.completionTokens ?? 0,
        cost: totalCost,
        latency: Math.round(Number(item._avg.latencyMs ?? 0)),
        costPerReq: reqCount > 0 ? totalCost / reqCount : 0,
        costPer1kTokens: totalToks > 0 ? totalCost / (totalToks / 1000) : 0,
      };
    });
  }
}