import { prisma } from "./src/lib/prisma";
import jwt from "jsonwebtoken";

async function testAllPlanRules() {
  console.log("==================================================================");
  console.log("🚀 SUÍTE COMPLETA DE TESTES: VALIDAÇÃO DE REGRAS E LIMITES DOS PLANOS");
  console.log("==================================================================\n");

  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" }
  }) || await prisma.user.findFirst();

  if (!user) {
    console.error("❌ Nenhum usuário encontrado para execução dos testes.");
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId }
  });

  if (!tenant) {
    console.error("❌ Tenant do usuário não encontrado.");
    process.exit(1);
  }

  const token = jwt.sign(
    { id: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET || "quota-system-secret"
  );

  const originalPlan = tenant.plan;
  const baseUrl = "http://localhost:3000";

  console.log(`📌 Tenant de Teste: "${tenant.name}" (${tenant.id})`);
  console.log(`📌 Usuário: "${user.email}" (${user.role})`);
  console.log(`📌 Plano Original: [${originalPlan}]\n`);

  const createdProjectIds: string[] = [];
  const createdAgentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdBillingGroupIds: string[] = [];
  const createdAssistantIds: string[] = [];
  const createdWidgetIds: string[] = [];
  const createdBudgetIds: string[] = [];
  const createdScheduleIds: string[] = [];

  try {
    // =========================================================================
    // ETAPA 1: TESTES NO PLANO STARTER
    // =========================================================================
    console.log("------------------------------------------------------------------");
    console.log("🔹 TESTANDO PLANO STARTER (Limites: 5 Metadados, 1 Assistente/Widget, Sem BI/Export)");
    console.log("------------------------------------------------------------------");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: "STARTER" }
    });

    // 1.1 Testar Limite de Projetos (STARTER: Máx 5)
    console.log("\n🧪 1.1 Testando limite de Projetos (Máx 5 no STARTER)...");
    // Preencher até 5 projetos
    const currentProjects = await (prisma as any).project.count({ where: { tenantId: tenant.id } });
    for (let i = currentProjects; i < 5; i++) {
      const res = await fetch(`${baseUrl}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: `Test_Proj_Starter_${Date.now()}_${i}` })
      });
      if (res.status === 201) {
        const data = await res.json() as any;
        createdProjectIds.push(data.id);
      }
    }
    // Tentar criar o 6º projeto -> Deve ser RECUSADO (403)
    const resOverProj = await fetch(`${baseUrl}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ name: `Test_Proj_Starter_EXCESS_${Date.now()}` })
    });
    const bodyOverProj = await resOverProj.json() as any;
    if (resOverProj.status === 403) {
      console.log(`   ✅ SUCESSO: 6º Projeto RECUSADO com HTTP 403 (${bodyOverProj.error})`);
    } else {
      console.error(`   ❌ FALHA: Esperava HTTP 403 ao criar 6º projeto, recebeu HTTP ${resOverProj.status}`);
    }

    // 1.2 Testar Limite de Agentes (STARTER: Máx 5)
    console.log("\n🧪 1.2 Testando limite de Agentes (Máx 5 no STARTER)...");
    const currentAgents = await (prisma as any).agent.count({ where: { tenantId: tenant.id } });
    for (let i = currentAgents; i < 5; i++) {
      const res = await fetch(`${baseUrl}/agents-management`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: `Test_Agent_Starter_${Date.now()}_${i}` })
      });
      if (res.status === 201) {
        const data = await res.json() as any;
        createdAgentIds.push(data.id);
      }
    }
    // Tentar criar o 6º agente -> Deve ser RECUSADO (403)
    const resOverAgent = await fetch(`${baseUrl}/agents-management`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ name: `Test_Agent_Starter_EXCESS_${Date.now()}` })
    });
    const bodyOverAgent = await resOverAgent.json() as any;
    if (resOverAgent.status === 403) {
      console.log(`   ✅ SUCESSO: 6º Agente RECUSADO com HTTP 403 (${bodyOverAgent.error})`);
    } else {
      console.error(`   ❌ FALHA: Esperava HTTP 403 ao criar 6º agente, recebeu HTTP ${resOverAgent.status}`);
    }


    // 1.3 Testar Limite de Centros de Custo / Billing Groups (STARTER: Máx 5)
    console.log("\n🧪 1.3 Testando limite de Billing Groups (Máx 5 no STARTER)...");
    const currentBG = await prisma.billingGroup.count({ where: { tenantId: tenant.id } });
    for (let i = currentBG; i < 5; i++) {
      const res = await fetch(`${baseUrl}/billing-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: `Test_BG_Starter_${Date.now()}_${i}` })
      });
      if (res.status === 201) {
        const data = await res.json() as any;
        createdBillingGroupIds.push(data.id);
      }
    }
    const resOverBG = await fetch(`${baseUrl}/billing-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ name: `Test_BG_Starter_EXCESS_${Date.now()}` })
    });
    const bodyOverBG = await resOverBG.json() as any;
    if (resOverBG.status === 403) {
      console.log(`   ✅ SUCESSO: 6º Billing Group RECUSADO com HTTP 403 (${bodyOverBG.error})`);
    } else {
      console.error(`   ❌ FALHA: Esperava HTTP 403 ao criar 6º Billing Group, recebeu HTTP ${resOverBG.status}`);
    }

    // 1.4 Testar Auto-Block no Budget (STARTER: Bloqueado)
    console.log("\n🧪 1.4 Testando Auto-Block de orçamento no STARTER...");
    const resAutoBlockStarter = await fetch(`${baseUrl}/budgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ limit: 100, period: "MONTHLY", autoBlock: true })
    });
    const bodyAutoBlockStarter = await resAutoBlockStarter.json() as any;
    if (resAutoBlockStarter.status === 403) {
      console.log(`   ✅ SUCESSO: Auto-Block no STARTER RECUSADO com HTTP 403 (${bodyAutoBlockStarter.error})`);
    } else {
      console.error(`   ❌ FALHA: Esperava HTTP 403 no Auto-Block do STARTER, recebeu HTTP ${resAutoBlockStarter.status}`);
    }

    // 1.5 Testar Agendamento de Relatório (STARTER: Bloqueado)
    console.log("\n🧪 1.5 Testando Agendamento de Relatório por E-mail no STARTER...");
    const resSchedStarter = await fetch(`${baseUrl}/reports/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ name: "Relatório Teste", frequency: "WEEKLY", email: "teste@quota.app" })
    });
    const bodySchedStarter = await resSchedStarter.json() as any;
    if (resSchedStarter.status === 403) {
      console.log(`   ✅ SUCESSO: Agendamento de Relatório no STARTER RECUSADO com HTTP 403 (${bodySchedStarter.error})`);
    } else {
      console.error(`   ❌ FALHA: Esperava HTTP 403 no agendamento do STARTER, recebeu HTTP ${resSchedStarter.status}`);
    }

    // =========================================================================
    // ETAPA 2: TESTES NO PLANO PRO
    // =========================================================================
    console.log("\n------------------------------------------------------------------");
    console.log("🔹 TESTANDO PLANO PRO (Upgrade para 20 Metadados, Auto-Block e Relatórios LIBERADOS)");
    console.log("------------------------------------------------------------------");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: "PRO" }
    });

    // 2.1 Testar se agora o 6º Projeto é LIBERADO no PRO
    console.log("\n🧪 2.1 Testando se a criação do 6º Projeto é PERMITIDA no PLANO PRO...");
    const resProjPro = await fetch(`${baseUrl}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ name: `Test_Proj_Pro_Allowed_${Date.now()}` })
    });
    if (resProjPro.status === 201) {
      const data = await resProjPro.json() as any;
      createdProjectIds.push(data.id);
      console.log(`   ✅ SUCESSO: 6º Projeto LIBERADO com HTTP 201 no PLANO PRO!`);
    } else {
      console.error(`   ❌ FALHA: Não permitiu criar projeto no PRO (HTTP ${resProjPro.status})`);
    }

    // 2.2 Testar Auto-Block no Budget (PRO: LIBERADO)
    console.log("\n🧪 2.2 Testando se o Auto-Block no orçamento é LIBERADO no PLANO PRO...");
    const resAutoBlockPro = await fetch(`${baseUrl}/budgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ limit: 500, period: "MONTHLY", autoBlock: true })
    });
    if (resAutoBlockPro.status === 201) {
      const data = await resAutoBlockPro.json() as any;
      createdBudgetIds.push(data.id);
      console.log(`   ✅ SUCESSO: Orçamento com Auto-Block CRIADO com HTTP 201 no PLANO PRO!`);
    } else {
      console.error(`   ❌ FALHA: Auto-block não liberado no PRO (HTTP ${resAutoBlockPro.status})`);
    }

    // 2.3 Testar Agendamento de Relatório (PRO: LIBERADO)
    console.log("\n🧪 2.3 Testando se Agendamento de Relatório por E-mail é LIBERADO no PLANO PRO...");
    const resSchedPro = await fetch(`${baseUrl}/reports/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ name: "Relatório Pro", frequency: "WEEKLY", email: "teste-pro@quota.app" })
    });
    if (resSchedPro.status === 201) {
      const data = await resSchedPro.json() as any;
      createdScheduleIds.push(data.id);
      console.log(`   ✅ SUCESSO: Agendamento de Relatório CRIADO com HTTP 201 no PLANO PRO!`);
    } else {
      console.error(`   ❌ FALHA: Agendamento não liberado no PRO (HTTP ${resSchedPro.status})`);
    }

    // 2.4 Testar Módulo BI no PRO (Deve continuar BLOQUEADO no PRO)
    console.log("\n🧪 2.4 Testando se Módulo BI permanece BLOQUEADO no PLANO PRO...");
    const resBIPro = await fetch(`${baseUrl}/analytics/bi/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ dimension: "provider" })
    });
    const bodyBIPro = await resBIPro.json() as any;
    if (resBIPro.status === 403) {
      console.log(`   ✅ SUCESSO: Módulo BI permanece RECUSADO com HTTP 403 no PRO (${bodyBIPro.message})`);
    } else {
      console.error(`   ❌ FALHA: Módulo BI deveria estar bloqueado no PRO!`);
    }

    // =========================================================================
    // ETAPA 3: TESTES NO PLANO ENTERPRISE
    // =========================================================================
    console.log("\n------------------------------------------------------------------");
    console.log("🔹 TESTANDO PLANO ENTERPRISE (Tudo Ilimitado + Módulo BI Liberado)");
    console.log("------------------------------------------------------------------");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: "ENTERPRISE" }
    });

    // 3.1 Testar Módulo BI no ENTERPRISE (Deve ser LIBERADO com HTTP 200)
    console.log("\n🧪 3.1 Testando se Módulo BI é LIBERADO no PLANO ENTERPRISE...");
    const resBIEnt = await fetch(`${baseUrl}/analytics/bi/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ dimension: "provider" })
    });
    if (resBIEnt.status === 200) {
      const dataBI = await resBIEnt.json() as any;
      console.log(`   ✅ SUCESSO: Módulo BI LIBERADO com HTTP 200 no PLANO ENTERPRISE!`);
      console.log(`      Retorno de dimensões:`, dataBI.dimension);
    } else {
      console.error(`   ❌ FALHA: BI não liberado no ENTERPRISE (HTTP ${resBIEnt.status})`);
    }

  } catch (err) {
    console.error("❌ Erro durante a suíte completa de testes:", err);
  } finally {
    // =========================================================================
    // LIMPEZA GERAL DE ENTIDADES DE TESTE E RESTAURAÇÃO DO PLANO
    // =========================================================================
    console.log("\n------------------------------------------------------------------");
    console.log("🧹 EFETUANDO LIMPEZA DAS ENTIDADES DE TESTE CRIADAS...");
    console.log("------------------------------------------------------------------");

    if (createdProjectIds.length > 0) {
      await (prisma as any).project.deleteMany({ where: { id: { in: createdProjectIds } } });
      console.log(`   └─ Removidos ${createdProjectIds.length} Projetos de teste.`);
    }

    if (createdAgentIds.length > 0) {
      await (prisma as any).agent.deleteMany({ where: { id: { in: createdAgentIds } } });
      console.log(`   └─ Removidos ${createdAgentIds.length} Agentes de teste.`);
    }

    if (createdBillingGroupIds.length > 0) {
      await prisma.billingGroup.deleteMany({ where: { id: { in: createdBillingGroupIds } } });
      console.log(`   └─ Removidos ${createdBillingGroupIds.length} Billing Groups de teste.`);
    }

    if (createdBudgetIds.length > 0) {
      await prisma.budget.deleteMany({ where: { id: { in: createdBudgetIds } } });
      console.log(`   └─ Removidos ${createdBudgetIds.length} Orçamentos de teste.`);
    }

    if (createdScheduleIds.length > 0) {
      await prisma.reportSchedule.deleteMany({ where: { id: { in: createdScheduleIds } } });
      console.log(`   └─ Removidos ${createdScheduleIds.length} Agendamentos de teste.`);
    }

    console.log(`\n🔄 Restaurando plano original do tenant para [${originalPlan}]...`);
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: originalPlan }
    });
    console.log("✅ Estado original do tenant restaurado com sucesso!");
    console.log("===================================================================\n");
    await prisma.$disconnect();
  }
}

testAllPlanRules();
