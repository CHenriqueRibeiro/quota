import { prisma } from "../lib/prisma";
import { getPlanLimits } from "../config/plan-limits";

export class PruningService {
  /**
   * Executa a limpeza de logs antigos em pequenos lotes (Batch Deletion)
   * para garantir IMPACTO ZERO de CPU/Memória na API e no PostgreSQL.
   */
  async pruneExpiredLogs() {
    try {
      const tenants = await prisma.tenant.findMany({
        select: { id: true, name: true, plan: true }
      });

      let totalDeleted = 0;

      for (const tenant of tenants) {
        const limits = getPlanLimits(tenant.plan);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - limits.dbRetentionDays);

        let batchDeleted = 0;

        // Deleta em pequenos lotes de 1.000 linhas por vez
        do {
          const expiredLogs = await prisma.usageLog.findMany({
            where: {
              tenantId: tenant.id,
              createdAt: { lt: cutoffDate }
            },
            select: { id: true },
            take: 1000
          });

          if (expiredLogs.length === 0) break;

          const ids = expiredLogs.map((l) => l.id);
          const result = await prisma.usageLog.deleteMany({
            where: { id: { in: ids } }
          });

          batchDeleted = result.count;
          totalDeleted += batchDeleted;

          // Pequena pausa de 50ms entre lotes para liberar conexões do banco
          if (batchDeleted >= 1000) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } while (batchDeleted >= 1000);

        if (totalDeleted > 0) {
          console.info(
            `[PruningService] Expurgo de ${totalDeleted} logs concluído no tenant '${tenant.name}' (${tenant.plan}).`
          );
        }
      }

      return { totalDeleted };
    } catch (error) {
      console.error("[PruningService] Erro durante limpeza de logs antigos:", error);
      return { totalDeleted: 0 };
    }
  }
}

export default new PruningService();
