import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import auditService from '../service/audit.service';

export class AuditController {
  async listLogs(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const query = (request.query || {}) as {
        tenantId?: string;
        category?: string;
        userEmail?: string;
        search?: string;
        level?: string;
        startDate?: string;
        endDate?: string;
        page?: string | number;
        limit?: string | number;
      };

      const resolvedTenantId = query.tenantId?.trim() || actor.tenantId;
      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (actor.role !== 'ADMIN' && resolvedTenantId !== actor.tenantId) {
        return reply.status(403).send({ error: 'Acesso negado para este tenant' });
      }

      const result = await auditService.listLogs({
        tenantId: resolvedTenantId,
        category: query.category,
        userEmail: query.userEmail,
        search: query.search,
        level: query.level,
        startDate: query.startDate,
        endDate: query.endDate,
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 50,
      });

      return reply.send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao listar registros de auditoria' });
    }
  }

  async getStats(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const query = (request.query || {}) as { tenantId?: string };
      const resolvedTenantId = query.tenantId?.trim() || actor.tenantId;

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      const stats = await auditService.getStats(resolvedTenantId);
      return reply.send(stats);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao obter estatísticas de auditoria' });
    }
  }

  async getCategories(_request: AuthenticatedRequest, reply: FastifyReply) {
    const categories = [
      { id: 'ALL', name: 'Todas as Categorias' },
      { id: 'QUOPILOT', name: 'Quopilot (Assistentes & Tópicos)' },
      { id: 'CREDENTIALS', name: 'Credenciais de IA & API Keys' },
      { id: 'BUDGET', name: 'Orçamento & Limites' },
      { id: 'METADATA', name: 'Metadados (Projetos, Agentes, Scopes, Tags)' },
      { id: 'ALERTS', name: 'Configurações de Alertas' },
      { id: 'SCHEDULES_EXPORTS', name: 'Agendamentos & Exportações' },
      { id: 'BI_REPORTS', name: 'Relatórios & Dashboards BI' },
      { id: 'USERS_SETTINGS', name: 'Usuários, Funções & Escopos' },
      { id: 'PLAN_CHANGE', name: 'Mudança de Plano & Tenant' },
      { id: 'LOGIN', name: 'Acesso & Autenticação de Usuários' },
    ];
    return reply.send({ categories });
  }

  async createLog(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      if (!actor) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const body = (request.body || {}) as {
        category: string;
        action: string;
        actionTitle: string;
        details: string;
        metadata?: any;
        level?: string;
        status?: string;
      };

      if (!body.category || !body.action || !body.details) {
        return reply.status(400).send({ error: 'category, action e details são obrigatórios' });
      }

      await auditService.logEvent({
        tenantId: actor.tenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: body.category,
        action: body.action,
        actionTitle: body.actionTitle || body.action,
        details: body.details,
        metadata: body.metadata,
        level: body.level || 'INFO',
        status: body.status || 'SUCCESS',
        ipAddress: request.ip,
      });

      return reply.status(201).send({ message: 'Log de auditoria registrado com sucesso' });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao registrar log de auditoria' });
    }
  }
}

export const auditController = new AuditController();
