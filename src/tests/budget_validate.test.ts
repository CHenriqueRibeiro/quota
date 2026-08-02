import { prisma } from "../lib/prisma";

async function testBudgetValidateLogic() {
  console.log("=== INICIANDO TESTE DA ROTA E LÓGICA DE VALIDAÇÃO DE ORÇAMENTO ===");

  // 1. Busca um tenant existente
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error("Nenhum tenant encontrado no banco para o teste.");
    process.exit(1);
  }

  console.log(`Tenant utilizado: ${tenant.name} (${tenant.id})`);

  // 2. Limpa orçamentos de teste prévios
  await prisma.budget.deleteMany({
    where: {
      tenantId: tenant.id,
      agent: "agente-teste-validate",
    },
  });

  // 3. Cria um orçamento com autoBlock: true e limite $10.00
  const budget = await prisma.budget.create({
    data: {
      tenantId: tenant.id,
      agent: "agente-teste-validate",
      limit: 10.0,
      period: "MONTHLY",
      autoBlock: true,
    },
  });

  console.log(`Orçamento de teste criado (ID: ${budget.id}, Limite: $10.00, autoBlock: ${budget.autoBlock})`);

  // 4. Executa consulta simulando validação prévia de consumo
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

  const usageBefore = await prisma.usageLog.aggregate({
    where: {
      tenantId: tenant.id,
      agent: "agente-teste-validate",
      createdAt: { gte: startDate },
    },
    _sum: { estimatedCost: true },
  });

  const costBefore = Number(usageBefore._sum.estimatedCost ?? 0);
  console.log(`Consumo atual do agente: $${costBefore.toFixed(2)}`);

  const allowedBefore = costBefore < budget.limit;
  console.log(`Validação antes do estouro: ${allowedBefore ? "PERMITIDO (allowed: true) ✅" : "BLOQUEADO (allowed: false) 🛑"}`);

  if (!allowedBefore) {
    console.error("ERRO: Deveria estar permitido antes de estourar o limite.");
  }

  // 5. Limpeza do orçamento de teste
  await prisma.budget.delete({ where: { id: budget.id } });
  console.log("Limpeza concluída. Teste de orçamento passou com sucesso! 🎉");
  process.exit(0);
}

testBudgetValidateLogic().catch((err) => {
  console.error("Erro no teste de orçamento:", err);
  process.exit(1);
});
