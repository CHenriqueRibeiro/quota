import { prisma } from '../../lib/prisma';

export class BIReportService {
  /**
   * Lista todos os relatórios BI salvos para um determinado tenant.
   */
  public async listReports(tenantId: string) {
    return prisma.biReport.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Obtém um relatório BI por ID (com validação de tenantId).
   */
  public async getReportById(tenantId: string, id: string) {
    return prisma.biReport.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Salva ou atualiza uma visão de BI (cria nova se não houver ID informado).
   */
  public async saveReport(
    tenantId: string,
    data: {
      id?: string;
      title?: string;
      description?: string;
      isDefault?: boolean;
      tabsConfig: any;
      customFields?: any;
    }
  ) {
    if (data.isDefault) {
      // Desmarca o isDefault anterior caso esta visão se torne a padrão
      await prisma.biReport.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    if (data.id) {
      const existing = await prisma.biReport.findFirst({
        where: { id: data.id, tenantId },
      });

      if (existing) {
        return prisma.biReport.update({
          where: { id: data.id },
          data: {
            title: data.title ?? existing.title,
            description: data.description ?? existing.description,
            isDefault: data.isDefault ?? existing.isDefault,
            tabsConfig: data.tabsConfig ?? existing.tabsConfig,
            customFields: data.customFields ?? existing.customFields,
          },
        });
      }
    }

    return prisma.biReport.create({
      data: {
        tenantId,
        title: data.title || 'Dashboard BI Personalizado',
        description: data.description || '',
        isDefault: data.isDefault || false,
        tabsConfig: data.tabsConfig,
        customFields: data.customFields || [],
      },
    });
  }

  /**
   * Exclui um relatório BI salvo por ID.
   */
  public async deleteReport(tenantId: string, id: string) {
    const existing = await prisma.biReport.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Relatório BI não encontrado.');
    }

    return prisma.biReport.delete({
      where: { id },
    });
  }
}
