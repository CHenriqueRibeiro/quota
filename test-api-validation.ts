import { prisma } from "./src/lib/prisma";
import jwt from "jsonwebtoken";

async function runApiValidation() {
  console.log("===============================================================");
  console.log("🚀 TESTANDO RESPOSTAS HTTP DOS ENDPOINTS COM TRAVAS DE PLANO");
  console.log("===============================================================\n");

  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" }
  }) || await prisma.user.findFirst();

  if (!user) {
    console.error("❌ Nenhum usuário encontrado para autenticação nos testes de API.");
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

  try {
    // -------------------------------------------------------------------------
    // 1. STARTER: Testar Bloqueio do BI (/analytics/query-bi ou via controlador)
    // -------------------------------------------------------------------------
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: "STARTER" }
    });

    console.log("🔹 1. Plano ajustado para [STARTER]. Testando endpoint de BI (/analytics/bi/query)...");

    const resBIStarter = await fetch("http://localhost:3000/analytics/bi/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ dimension: "provider" })
    });

    const bodyBIStarter = await resBIStarter.json() as any;
    console.log(`   Status HTTP recebido: ${resBIStarter.status}`);
    console.log(`   Resposta do servidor:`, bodyBIStarter);

    if (resBIStarter.status === 403) {
      console.log("   ✅ SUCESSO: Endpoint de BI recusado com HTTP 403 no plano STARTER!\n");
    } else {
      console.warn("   ⚠️ Resposta diferente do esperado de 403\n");
    }

    // -------------------------------------------------------------------------
    // 2. STARTER: Testar Bloqueio de Exportação de Relatórios (/reports/export/detailed)
    // -------------------------------------------------------------------------
    console.log("🔹 2. Testando exportação de relatório CSV no [STARTER]...");

    const resExportStarter = await fetch("http://localhost:3000/reports/export/detailed", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const bodyExportStarter = resExportStarter.headers.get("content-type")?.includes("json")
      ? await resExportStarter.json()
      : await resExportStarter.text();

    console.log(`   Status HTTP recebido: ${resExportStarter.status}`);
    console.log(`   Resposta do servidor:`, bodyExportStarter);

    if (resExportStarter.status === 403) {
      console.log("   ✅ SUCESSO: Exportação de relatórios recusada com HTTP 403 no plano STARTER!\n");
    }

    // -------------------------------------------------------------------------
    // 3. ENTERPRISE: Testar Liberação do Módulo BI (/analytics/bi/query)
    // -------------------------------------------------------------------------
    console.log("🔹 3. Fazendo upgrade para [ENTERPRISE] e retestando Módulo BI (/analytics/bi/query)...");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: "ENTERPRISE" }
    });

    const resBIEnterprise = await fetch("http://localhost:3000/analytics/bi/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ dimension: "provider" })
    });

    const bodyBIEnterprise = await resBIEnterprise.json() as any;
    console.log(`   Status HTTP recebido: ${resBIEnterprise.status}`);
    console.log(`   Resposta do servidor:`, bodyBIEnterprise);

    if (resBIEnterprise.status === 200) {
      console.log("   ✅ SUCESSO: Módulo BI liberado com HTTP 200 no plano ENTERPRISE!\n");
    }


  } catch (err) {
    console.error("❌ Erro durante validação via HTTP:", err);
  } finally {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: originalPlan }
    });
    console.log("🔄 Plano original restaurado com sucesso!");
    console.log("===============================================================");
    await prisma.$disconnect();
  }
}

runApiValidation();
