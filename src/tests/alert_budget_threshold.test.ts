import { prisma } from "../lib/prisma";
import { processAlerts } from "../service/alert-engine.service";

async function testBudgetAlertThreshold() {
  console.log("=== INICIANDO TESTE DE ALERTA VINCULADO A ORÇAMENTO ===");

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error("Nenhum tenant encontrado no banco.");
    process.exit(1);
  }

  // 1. Limpa registros de teste anteriores
  await prisma.alertConfig.deleteMany({
    where: { tenantId: tenant.id, email: "teste-budget-alert@empresa.com" }
  });

  // 2. Cria uma regra de alerta do tipo BUDGET por Porcentagem (80%)
  const alert = await prisma.alertConfig.create({
    data: {
      tenantId: tenant.id,
      type: "BUDGET",
      period: "MONTHLY",
      threshold: 80, // 80% do orçamento
      thresholdType: "PERCENTAGE",
      email: "teste-budget-alert@empresa.com",
      enabled: true,
    }
  });

  console.log(`Regra de Alerta de Orçamento criada: ID ${alert.id}, Threshold: ${alert.threshold}%`);

  // 3. Executa o motor de alertas
  await processAlerts(tenant.id);
  console.log("Motor de alertas executado com sucesso!");

  // 4. Limpeza
  await prisma.alertConfig.delete({ where: { id: alert.id } });
  console.log("Teste de Alerta de Orçamento concluído com sucesso! 🎉");
  process.exit(0);
}

testBudgetAlertThreshold().catch((err) => {
  console.error("Erro no teste de alerta de orçamento:", err);
  process.exit(1);
});
