import { prisma } from "../lib/prisma";
import reportsService from "../service/reports.service";

async function testReportsAndCsvImportExport() {
  console.log("=== INICIANDO TESTE COMPLETO DE RELATÓRIOS & CSV ===");

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error("Nenhum tenant encontrado no banco.");
    process.exit(1);
  }

  // 1. Teste de Exportação Detalhada em CSV
  const detailedCsv = await reportsService.generateDetailedCsv({
    tenantId: tenant.id
  });
  console.log(`[CSV Detalhado] Gerado com ${detailedCsv.split('\n').length} linhas.`);

  // 2. Teste de Exportação Consolidada do Dashboard (Overview) em CSV
  const overviewCsv = await reportsService.generateOverviewCsv({
    tenantId: tenant.id
  });
  console.log(`[CSV Overview] Gerado com ${overviewCsv.split('\n').length} linhas:\n${overviewCsv.slice(0, 250)}...`);

  // 3. Teste de Importação de Usuários em Lote via CSV (incluindo Escopo por Nome)
  const testScope = await prisma.scope.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Escopo Teste CSV" } },
    create: { tenantId: tenant.id, name: "Escopo Teste CSV" },
    update: {}
  });

  const sampleUsersCsv = `Nome,Email,Role,Senha,Escopo
Teste Importador 1,importador1@empresa-teste.com,ANALYST,Senha@123456,Escopo Teste CSV
Teste Importador 2,importador2@empresa-teste.com,MANAGER,Senha@123456,`;

  const usersImportRes = await reportsService.importUsersCsv(tenant.id, sampleUsersCsv);
  console.log(`[Importação de Usuários] Criados: ${usersImportRes.createdUsers}, Já existiam: ${usersImportRes.existingCount}`);

  const userWithScope = await prisma.user.findFirst({ where: { email: "importador1@empresa-teste.com" } });
  if (userWithScope?.scopeId === testScope.id) {
    console.log("✅ Usuário 1 associado corretamente ao escopo pelo nome!");
  } else {
    console.error("❌ Falha na associação do escopo por nome. Esperado:", testScope.id, "Recebido:", userWithScope?.scopeId);
  }

  // 4. Teste de Importação de Consumo Histórico via CSV
  const sampleUsageCsv = `Provider,Model,PromptTokens,CompletionTokens,Cost,Project,Agent
openai,gpt-4o,100,50,0.005,Projeto Teste CSV,Agente Teste CSV`;

  const usageImportRes = await reportsService.importUsageCsv(tenant.id, sampleUsageCsv);
  console.log(`[Importação de Consumo] Importados: ${usageImportRes.importedCount}`);

  // 5. Limpeza dos dados de teste
  await prisma.user.deleteMany({
    where: { email: { in: ["importador1@empresa-teste.com", "importador2@empresa-teste.com"] } }
  });
  await prisma.scope.delete({ where: { id: testScope.id } }).catch(() => {});
  await prisma.usageLog.deleteMany({
    where: { project: "Projeto Teste CSV" }
  });

  console.log("Teste de relatórios e CSV concluído com sucesso! 🎉");
  process.exit(0);
}

testReportsAndCsvImportExport().catch((err) => {
  console.error("Erro no teste de relatórios:", err);
  process.exit(1);
});
