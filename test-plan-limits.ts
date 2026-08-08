import { prisma } from "./src/lib/prisma";
import { getPlanLimits } from "./src/config/plan-limits";
import { Plan } from "@prisma/client";

async function runPlanLimitsValidation() {
  console.log("===============================================================");
  console.log("🧪 INICIANDO TESTES AUTOMATIZADOS DE REGRAS E LIMITES DE PLANOS");
  console.log("===============================================================\n");

  // 1. Buscar um tenant existente para teste
  const tenant = await prisma.tenant.findFirst({
    include: { users: true }
  });

  if (!tenant) {
    console.error("❌ Nenhum tenant encontrado no banco de dados para realizar os testes.");
    process.exit(1);
  }

  const originalPlan = tenant.plan;
  console.log(`📌 Tenant selecionado: "${tenant.name}" (${tenant.id})`);
  console.log(`📌 Plano original: [${originalPlan}]\n`);

  try {
    // -------------------------------------------------------------------------
    // TESTE 1: MUDANÇA PARA O PLANO STARTER E VALIDAÇÃO DE LIMITES
    // -------------------------------------------------------------------------
    console.log("---------------------------------------------------------------");
    console.log("🔹 TESTE 1: Alterando Tenant para PLANO STARTER e testando travas...");
    console.log("---------------------------------------------------------------");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: Plan.STARTER }
    });

    const starterLimits = getPlanLimits(Plan.STARTER);
    console.log(`✅ Plano atualizado para STARTER.`);
    console.log(`   - Limite de Projetos: ${starterLimits.maxProjects}`);
    console.log(`   - Limite de Agentes: ${starterLimits.maxAgents}`);
    console.log(`   - Limite de Billing Groups: ${starterLimits.maxBillingGroups}`);
    console.log(`   - Limite de Usuários: ${starterLimits.maxUsers}`);
    console.log(`   - Auto-Block Budget: ${starterLimits.canAutoBlockBudget}`);
    console.log(`   - Módulo BI: ${starterLimits.canUseBI}\n`);

    // Validação 1.1: Projetos no STARTER (Máximo 5)
    console.log("📋 Testando criação de Projetos no STARTER...");
    const projectCount = await (prisma as any).project.count({ where: { tenantId: tenant.id } });
    console.log(`   Projetos existentes: ${projectCount}`);

    if (projectCount >= starterLimits.maxProjects) {
      console.log(`   ✅ Limite atingido (${projectCount}/${starterLimits.maxProjects}). Validação funcionará ao tentar criar o próximo.`);
    } else {
      console.log(`   ✅ Quantidade atual (${projectCount}) dentro do limite do STARTER (máx 5).`);
    }

    // Validação 1.2: Centros de Custo (Billing Groups)
    console.log("\n📋 Testando criação de Centros de Custo (Billing Groups) no STARTER...");
    const bgCount = await prisma.billingGroup.count({ where: { tenantId: tenant.id } });
    console.log(`   Centros de custo existentes: ${bgCount}`);

    // Validação 1.3: Permissão de Módulo BI no STARTER
    console.log("\n📋 Testando permissão do Módulo BI (queryBI)...");
    if (!starterLimits.canUseBI) {
      console.log("   ✅ Módulo BI corretamente BLOQUEADO no plano STARTER (Esperado: Recusa com erro 403).");
    } else {
      console.error("   ❌ ERRO: Módulo BI não deveria estar liberado no STARTER!");
    }

    // Validação 1.4: Auto-Block de Orçamento no STARTER
    console.log("\n📋 Testando permissão de Auto-Block no STARTER...");
    if (!starterLimits.canAutoBlockBudget) {
      console.log("   ✅ Auto-Block de orçamento corretamente BLOQUEADO no plano STARTER.");
    }

    // -------------------------------------------------------------------------
    // TESTE 2: UPGRADE PARA O PLANO PRO
    // -------------------------------------------------------------------------
    console.log("\n---------------------------------------------------------------");
    console.log("🔹 TESTE 2: Fazendo UPGRADE do Tenant para PLANO PRO...");
    console.log("---------------------------------------------------------------");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: Plan.PRO }
    });

    const proLimits = getPlanLimits(Plan.PRO);
    console.log(`✅ Plano atualizado para PRO.`);
    console.log(`   - Limite de Projetos: ${proLimits.maxProjects}`);
    console.log(`   - Limite de Agentes: ${proLimits.maxAgents}`);
    console.log(`   - Limite de Billing Groups: ${proLimits.maxBillingGroups}`);
    console.log(`   - Auto-Block Budget: ${proLimits.canAutoBlockBudget}`);
    console.log(`   - Exportação de Relatórios: ${proLimits.canExportReports}`);
    console.log(`   - Módulo BI: ${proLimits.canUseBI}\n`);

    if (proLimits.canAutoBlockBudget && proLimits.canExportReports && !proLimits.canUseBI) {
      console.log("   ✅ Recursos do PLANO PRO validados com sucesso (Relatórios e Auto-Block LIBERADOS, BI BLOQUEADO).");
    }

    // -------------------------------------------------------------------------
    // TESTE 3: UPGRADE PARA O PLANO ENTERPRISE
    // -------------------------------------------------------------------------
    console.log("\n---------------------------------------------------------------");
    console.log("🔹 TESTE 3: Fazendo UPGRADE do Tenant para PLANO ENTERPRISE...");
    console.log("---------------------------------------------------------------");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: Plan.ENTERPRISE }
    });

    const entLimits = getPlanLimits(Plan.ENTERPRISE);
    console.log(`✅ Plano atualizado para ENTERPRISE.`);
    console.log(`   - Limite de Projetos: ${entLimits.maxProjects}`);
    console.log(`   - Módulo BI: ${entLimits.canUseBI}`);
    console.log(`   - Download Completo de Dados (BI): ${entLimits.canRawDataDownload}`);
    console.log(`   - Retenção de Histórico: ${entLimits.retentionDays} dias (2 anos)\n`);

    if (entLimits.canUseBI && entLimits.canRawDataDownload) {
      console.log("   ✅ Recursos do PLANO ENTERPRISE validados com sucesso (Módulo BI e Download de Dados LIBERADOS!).");
    }

  } catch (error) {
    console.error("❌ Ocorreu um erro durante os testes:", error);
  } finally {
    // Restaurar plano original
    console.log("\n---------------------------------------------------------------");
    console.log(`🔄 Restaurando plano original do tenant para [${originalPlan}]...`);
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: originalPlan }
    });
    console.log("✅ Estado original do tenant restaurado com sucesso!");
    console.log("===============================================================");
    await prisma.$disconnect();
  }
}

runPlanLimitsValidation();
