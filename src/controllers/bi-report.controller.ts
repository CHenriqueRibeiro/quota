import type { FastifyReply } from 'fastify';
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
}
