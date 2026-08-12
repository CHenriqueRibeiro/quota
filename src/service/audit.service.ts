import { prisma } from '../lib/prisma';

export type AuditCategory =
  | 'QUOPILOT'
  | 'CREDENTIALS'
  | 'BUDGET'
  | 'METADATA'
  | 'ALERTS'
  | 'SCHEDULES_EXPORTS'
  | 'BI_REPORTS'
  | 'USERS_SETTINGS'
  | 'PLAN_CHANGE'
  | 'LOGIN';

export interface LogAuditEventParams {
  tenantId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  category: AuditCategory | string;
  action: string;
  actionTitle: string;
  details: string;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  status?: string;
  level?: string;
}

export interface ListAuditLogsParams {
  tenantId: string;
  category?: string;
  userEmail?: string;
  search?: string;
  level?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class AuditService {
  /**
   * Registra um novo log de auditoria no banco de dados de forma assíncrona.
   * Não lança exceção no caso de falha para não interromper o fluxo principal.
   */
  async logEvent(params: LogAuditEventParams): Promise<void> {
    try {
      if (!params.tenantId) {
        return;
      }

      await prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId || null,
          userName: params.userName || null,
          userEmail: params.userEmail || null,
          userRole: params.userRole || null,
          category: params.category,
          action: params.action,
          actionTitle: params.actionTitle,
          details: params.details,
          metadata: params.metadata ? (params.metadata as any) : undefined,
          ipAddress: params.ipAddress || null,
          status: params.status || 'SUCCESS',
          level: params.level || 'INFO',
        },
      });
    } catch (err) {
      console.error('[AuditService] Erro ao gravar log de auditoria:', err);
    }
  }

  /**
   * Lista os logs de auditoria com suporte a filtros e paginação.
   */
  async listLogs(params: ListAuditLogsParams) {
    const {
      tenantId,
      category,
      userEmail,
      search,
      level,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = params;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      tenantId,
      NOT: [
        { userRole: { in: ['SISTEMA', 'SYSTEM'] } },
        { userEmail: { in: ['sistema@quota.internal'] } },
      ],
    };

    if (category && category !== 'ALL') {
      // Mapeamento flexível de categorias
      if (category === 'LOGINS') {
        where.category = { in: ['LOGIN', 'USERS_SETTINGS'] };
      } else if (category === 'CREDENCIAS' || category === 'CREDENTIALS') {
        where.category = { in: ['CREDENTIALS', 'Credencial IA'] };
      } else if (category === 'AGENDAMENTOS' || category === 'SCHEDULES_EXPORTS') {
        where.category = { in: ['SCHEDULES_EXPORTS', 'BI_REPORTS', 'Agendamento', 'Relatório BI'] };
      } else if (category === 'ALERTAS' || category === 'ALERTS' || category === 'BUDGET') {
        where.category = { in: ['ALERTS', 'BUDGET', 'Alerta', 'Orçamento'] };
      } else if (category === 'QUOPILOT') {
        where.category = { in: ['QUOPILOT', 'Quopilot'] };
      } else if (category === 'METADATA') {
        where.category = { in: ['METADATA', 'Metadados'] };
      } else if (category === 'PLAN_CHANGE') {
        where.category = { in: ['PLAN_CHANGE', 'Mudança de Plano'] };
      } else {
        where.category = category;
      }
    }

    if (userEmail && userEmail !== 'ALL') {
      where.userEmail = {
        equals: userEmail.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    if (level && level !== 'ALL') {
      where.level = level;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { actionTitle: { contains: searchTerm, mode: 'insensitive' } },
        { action: { contains: searchTerm, mode: 'insensitive' } },
        { details: { contains: searchTerm, mode: 'insensitive' } },
        { userName: { contains: searchTerm, mode: 'insensitive' } },
        { userEmail: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  /**
   * Obtém estatísticas e resumo de auditoria para o tenant.
   */
  async getStats(tenantId: string) {
    const [totalLogs, categoryCounts, recentLogs] = await Promise.all([
      prisma.auditLog.count({ where: { tenantId } }),
      prisma.auditLog.groupBy({
        by: ['category'],
        where: { tenantId },
        _count: { category: true },
      }),
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const categoriesMap: Record<string, number> = {};
    categoryCounts.forEach((c) => {
      categoriesMap[c.category] = c._count.category;
    });

    return {
      totalLogs,
      categoriesMap,
      recentLogs,
    };
  }
}

export const auditService = new AuditService();
export default auditService;
