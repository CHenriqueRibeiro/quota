import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { usageQueue } from "../../lib/queue";

export default class DashboardService {

  static async getSummary(
    where: Prisma.UsageLogWhereInput,
    startDate: Date,
    endDate: Date
  ) {

    const usage = await prisma.usageLog.aggregate({

      where,

      _count: {
        id: true
      },

      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        estimatedCost: true
      },

      _avg: {
        latencyMs: true
      }

    });

    return {

      requests:
        usage._count.id,

      tokens: {

        total:
          usage._sum.totalTokens ?? 0,

        input:
          usage._sum.promptTokens ?? 0,

        output:
          usage._sum.completionTokens ?? 0

      },

      costs: {

        total:
          Number(
            usage._sum.estimatedCost ?? 0
          ),

        currency: "BRL"

      },

      latency: {

        averageMs:
          Math.round(
            Number(
              usage._avg.latencyMs ?? 0
            )
          )

      },

      period: {

        startDate,

        endDate

      }

    };

  }

  static async getProviders(
  where: Prisma.UsageLogWhereInput
) {

  const providersRaw =
    await prisma.usageLog.groupBy({

      where,

      by: [
        "provider"
      ],

      _sum: {
        totalTokens: true,
        estimatedCost: true
      },

      _count: {
        id: true
      }

    });

  return providersRaw.map(item => ({

    name: item.provider,

    requests: item._count.id,

    tokens: item._sum.totalTokens ?? 0,

    cost: Number(
      item._sum.estimatedCost ?? 0
    )

  }));

}

static async getModels(
  where: Prisma.UsageLogWhereInput
) {

  const modelsRaw =
    await prisma.usageLog.groupBy({

      where,

      by: [
        "model"
      ],

      _sum: {
        totalTokens: true,
        estimatedCost: true
      },

      _count: {
        id: true
      }

    });

  return modelsRaw.map(item => ({

    name: item.model,

    requests: item._count.id,

    tokens: item._sum.totalTokens ?? 0,

    cost: Number(
      item._sum.estimatedCost ?? 0
    )

  }));

}

static async getProjects(
  where: Prisma.UsageLogWhereInput
) {

  const projectsRaw =
    await prisma.usageLog.groupBy({

      where,

      by: [
        "project"
      ],

      _sum: {
        totalTokens: true,
        estimatedCost: true
      },

      _count: {
        id: true
      }

    });

  return projectsRaw.map(item => ({

    name:
      item.project ?? "Sem projeto",

    requests:
      item._count.id,

    tokens:
      item._sum.totalTokens ?? 0,

    cost:
      Number(
        item._sum.estimatedCost ?? 0
      )

  }));

}

static async getAgents(
  where: Prisma.UsageLogWhereInput
) {

  const agentsRaw =
    await prisma.usageLog.groupBy({

      where,

      by: [
        "agent"
      ],

      _sum: {
        totalTokens: true,
        estimatedCost: true
      },

      _count: {
        id: true
      }

    });

  return agentsRaw
    .map(item => ({

      name:
        item.agent ?? "Sem agente",

      requests:
        item._count.id,

      tokens:
        item._sum.totalTokens ?? 0,

      cost:
        Number(
          item._sum.estimatedCost ?? 0
        )

    }))
    .sort(
      (a, b) => b.tokens - a.tokens
    );

}

static async getTags(
  where: Prisma.UsageLogWhereInput
) {
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

static async getUsers(
  where: Prisma.UsageLogWhereInput
) {

  const usersRaw =
    await prisma.usageLog.groupBy({

      where,

      by: [
        "externalUserId"
      ],

      _sum: {
        totalTokens: true,
        estimatedCost: true
      },

      _count: {
        id: true
      }

    });

  return usersRaw
    .map(item => ({

      name:
        item.externalUserId ?? "Sem usuário",

      requests:
        item._count.id,

      tokens:
        item._sum.totalTokens ?? 0,

      cost:
        Number(
          item._sum.estimatedCost ?? 0
        )

    }))
    .sort(
      (a, b) => b.tokens - a.tokens
    );

}

static async getBillingGroups(
  where: Prisma.UsageLogWhereInput
) {

  const billingGroupsRaw =
    await prisma.usageLog.groupBy({

      where,

      by: [
        "billingGroupId"
      ],

      _sum: {
        totalTokens: true,
        estimatedCost: true
      },

      _count: {
        id: true
      }

    });

  const billingGroupsTemp =
    await Promise.all(

      billingGroupsRaw.map(async item => {

        let name = "Sem grupo";

        if (item.billingGroupId) {

          const group =
            await prisma.billingGroup.findUnique({

              where: {
                id: item.billingGroupId
              }

            });

          if (group) {
            name = group.name;
          }

        }

        return {

          name,

          requests: item._count.id,

          tokens:
            item._sum.totalTokens ?? 0,

          cost:
            Number(
              item._sum.estimatedCost ?? 0
            )

        };

      })

    );

  const billingMap = new Map();

  for (const item of billingGroupsTemp) {

    const current =
      billingMap.get(item.name);

    if (current) {

      current.requests += item.requests;
      current.tokens += item.tokens;
      current.cost += item.cost;

    } else {

      billingMap.set(item.name, item);

    }

  }

  return Array.from(
    billingMap.values()
  );

}

static async getDailyConsumption(
  where: Prisma.UsageLogWhereInput
) {

  const dailyRaw =
    await prisma.usageLog.findMany({

      where,

      select: {
        createdAt: true,
        totalTokens: true,
        estimatedCost: true
      }

    });

  const dailyMap = new Map();

  for (const item of dailyRaw) {

    const date =
      item.createdAt
        .toISOString()
        .split("T")[0];

    const current =
      dailyMap.get(date);

    if (current) {

      current.requests++;

      current.tokens +=
        item.totalTokens ?? 0;

      current.cost +=
        Number(
          item.estimatedCost ?? 0
        );

    } else {

      dailyMap.set(date, {

        date,

        requests: 1,

        tokens:
          item.totalTokens ?? 0,

        cost:
          Number(
            item.estimatedCost ?? 0
          )

      });

    }

  }

  return Array.from(
    dailyMap.values()
  ).sort(
    (a, b) =>
      a.date.localeCompare(b.date)
  );

}

static async getLatency(
  where: Prisma.UsageLogWhereInput
) {

  const latencyRaw =
    await prisma.usageLog.findMany({

      where,

      select: {
        latencyMs: true
      }

    });

  const values =
    latencyRaw
      .map(item => item.latencyMs)
      .filter(
        (v): v is number =>
          v !== null
      )
      .sort((a, b) => a - b);

  function percentile(
    values: number[],
    percentile: number
  ) {

    if (!values.length) {
      return 0;
    }

    const index =
      Math.ceil(
        percentile / 100 * values.length
      ) - 1;

    return values[index] ?? 0;

  }

  return {

    average:
      values.length
        ? Math.round(
            values.reduce(
              (a, b) => a + b,
              0
            ) / values.length
          )
        : 0,

    p50:
      percentile(values, 50),

    p95:
      percentile(values, 95),

    p99:
      percentile(values, 99)

  };

}

static async getErrors(
  where: Prisma.UsageLogWhereInput
) {

  const errorsRaw =
    await prisma.usageLog.groupBy({

      where,

      by: [
        "statusCode"
      ],

      _count: {
        id: true
      }

    });

  return {

    success:

      errorsRaw

        .filter(e =>
          e.statusCode &&
          e.statusCode >= 200 &&
          e.statusCode < 300
        )

        .reduce(
          (a, b) =>
            a + b._count.id,
          0
        ),

    clientErrors:

      errorsRaw

        .filter(e =>
          e.statusCode &&
          e.statusCode >= 400 &&
          e.statusCode < 500
        )

        .reduce(
          (a, b) =>
            a + b._count.id,
          0
        ),

    serverErrors:

      errorsRaw

        .filter(e =>
          e.statusCode &&
          e.statusCode >= 500
        )

        .reduce(
          (a, b) =>
            a + b._count.id,
          0
        )

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
    retries
  ] = await Promise.all([

    usageQueue.getWaitingCount(),

    usageQueue.getActiveCount(),

    prisma.failedUsage.count({
      where: {
        tenantId,
        lastAttemptAt: {
          gte: startDate,
          lte: endDate
        }
      }
    }),

    prisma.usageLog.count({
      where
    }),

    prisma.usageLog.aggregate({

      where,

      _avg: {
        latencyMs: true
      }

    }),

    prisma.failedUsage.aggregate({

      where: {
        tenantId,
        lastAttemptAt: {
          gte: startDate,
          lte: endDate
        }
      },

      _sum: {
        attempts: true
      }

    })

  ]);

  const errorRate =
    processedJobs > 0
      ? Number(
          (
            (failedJobs / processedJobs) *
            100
          ).toFixed(2)
        )
      : 0;

  return {

    processed:
      processedJobs,

    pending:
      pendingJobs,

    active:
      activeJobs,

    failed:
      failedJobs,

    errorRate:
      `${errorRate}%`,

    averageProcessingTimeMs:
      Math.round(
        Number(
          averageProcessing._avg.latencyMs ?? 0
        )
      ),

    retries:
      retries._sum?.attempts ?? 0

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
      const search = options.search.trim();
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
      "externalUserId"
    ];

    const groupByField = validDimensions.includes(dimension) ? (dimension as any) : "provider";

    const aggregated = await prisma.usageLog.groupBy({
      where,
      by: [groupByField],
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        estimatedCost: true
      },
      _avg: {
        latencyMs: true
      },
      _count: {
        id: true
      }
    });

    return aggregated.map(item => {
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
        costPer1kTokens: totalToks > 0 ? (totalCost / (totalToks / 1000)) : 0
      };
    });
  }
}