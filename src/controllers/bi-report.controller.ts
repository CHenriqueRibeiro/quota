import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import { BIReportService } from '../service/analytics/bi-report.service';

const reportService = new BIReportService();

export class BIReportController {
  public async listReports(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ success: false, message: 'Não autenticado.' });
      }

      const reports = await reportService.listReports(tenantId);
      return reply.status(200).send({ success: true, data: reports });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message || 'Erro ao listar relatórios BI.' });
    }
  }

  public async getReportById(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ success: false, message: 'Não autenticado.' });
      }

      const { id } = request.params as { id: string };
      const report = await reportService.getReportById(tenantId, id);

      if (!report) {
        return reply.status(404).send({ success: false, message: 'Relatório BI não encontrado.' });
      }

      return reply.status(200).send({ success: true, data: report });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message || 'Erro ao buscar relatório BI.' });
    }
  }

  public async saveReport(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ success: false, message: 'Não autenticado.' });
      }

      const body = request.body as {
        id?: string;
        title?: string;
        description?: string;
        isDefault?: boolean;
        tabsConfig: any;
        customFields?: any;
      };

      if (!body || !body.tabsConfig) {
        return reply.status(400).send({ success: false, message: 'O parâmetro tabsConfig é obrigatório.' });
      }

      const savedReport = await reportService.saveReport(tenantId, {
        id: body.id,
        title: body.title,
        description: body.description,
        isDefault: body.isDefault,
        tabsConfig: body.tabsConfig,
        customFields: body.customFields,
      });

      return reply.status(200).send({ success: true, data: savedReport });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message || 'Erro ao salvar relatório BI.' });
    }
  }

  public async deleteReport(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ success: false, message: 'Não autenticado.' });
      }

      const { id } = request.params as { id: string };
      await reportService.deleteReport(tenantId, id);

      return reply.status(200).send({ success: true, message: 'Relatório BI excluído com sucesso.' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message || 'Erro ao excluir relatório BI.' });
    }
  }

  public async shareReport(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ success: false, message: 'Não autenticado.' });
      }

      const { id } = request.params as { id: string };
      const body = request.body as { publicExpiresAt?: string | null; isPublic?: boolean };

      const updated = await reportService.shareReport(tenantId, id, body || {});
      return reply.status(200).send({ success: true, data: updated });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message || 'Erro ao compartilhar relatório.' });
    }
  }

  public async revokeShare(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ success: false, message: 'Não autenticado.' });
      }

      const { id } = request.params as { id: string };
      const updated = await reportService.revokeShare(tenantId, id);

      return reply.status(200).send({
        success: true,
        message: 'Acesso público revogado com sucesso. O link não funcionará mais!',
        data: updated,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message || 'Erro ao revogar acesso público.' });
    }
  }

  public async updateSchedule(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        return reply.status(401).send({ success: false, message: 'Não autenticado.' });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        scheduleEnabled: boolean;
        scheduleEmail?: string;
        scheduleCc?: string[];
        scheduleFrequency?: string;
        scheduleDayOfWeek?: number;
        scheduleDayOfMonth?: number;
        scheduleTime?: string;
      };

      const updated = await reportService.updateSchedule(tenantId, id, body);
      return reply.status(200).send({ success: true, data: updated });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message || 'Erro ao agendar envio por e-mail.' });
    }
  }

  /**
   * ROTA PÚBLICA (LIVRE DE AUTENTICAÇÃO)
   * GET /public/bi-report/:token
   */
  public async getPublicReport(request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) {
    try {
      const { token } = request.params;
      const result = await reportService.getReportByShareToken(token);

      if (result.status === 'NOT_FOUND') {
        return reply.status(404).send({ success: false, status: 'NOT_FOUND', message: 'Relatório não encontrado.' });
      }

      if (result.status === 'REVOKED') {
        return reply.status(403).send({
          success: false,
          status: 'REVOKED',
          message: 'O acesso a este relatório público foi revogado pelo administrador.',
        });
      }

      if (result.status === 'EXPIRED') {
        return reply.status(410).send({
          success: false,
          status: 'EXPIRED',
          message: 'O prazo de validade deste relatório público expirou.',
        });
      }

      return reply.status(200).send({
        success: true,
        status: 'VALID',
        data: result.report,
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message || 'Erro ao carregar relatório público.' });
    }
  }
}
