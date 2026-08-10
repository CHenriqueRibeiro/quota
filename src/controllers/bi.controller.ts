import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../types/auth';
import { BI_CATALOG_EXPORT } from '../config/bi-catalog.config';
import { biQuerySchema } from '../schemas/bi-query.schema';
import { BIQueryService } from '../service/analytics/bi-query.service';

const biQueryService = new BIQueryService();

export class BIController {
  /**
   * GET /analytics/bi/catalog
   * Retorna o catálogo imutável de dimensões, métricas e operadores permitidos.
   */
  public async getCatalog(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send({
        success: true,
        catalog: BI_CATALOG_EXPORT,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        message: error.message || 'Erro interno ao obter catálogo de BI.',
      });
    }
  }

  /**
   * POST /analytics/bi/query
   * Executa a consulta customizada com validação de catálogo e campos calculados.
   */
  public async executeQuery(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const tenantId = request.user?.tenantId;

      if (!tenantId) {
        return reply.status(401).send({
          success: false,
          message: 'Tenant não identificado ou usuário não autenticado.',
        });
      }

      // Validação do corpo da requisição usando Zod
      const parseResult = biQuerySchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          message: 'Parâmetros de consulta de BI inválidos.',
          errors: parseResult.error.format(),
        });
      }

      const input = parseResult.data;

      // Executa a consulta segura
      const result = await biQueryService.executeQuery(tenantId, input);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        message: error.message || 'Erro ao processar consulta de BI.',
      });
    }
  }
}
