import { prisma } from "./src/lib/prisma";

async function testMonthlyRequestLimit() {
  console.log("===============================================================");
  console.log("🚀 TESTANDO LIMITE MENSAL DE REQUISIÇÕES DE IA (HTTP 429)");
  console.log("===============================================================\n");

  const apiKey = await prisma.apiKey.findFirst({
    where: { isActive: true },
    include: { tenant: true }
  });

  if (!apiKey) {
    console.error("❌ Nenhuma API Key ativa encontrada para teste.");
    process.exit(1);
  }

  const tenant = apiKey.tenant;
  const originalPlan = tenant.plan;

  console.log(`📌 Tenant de Teste: "${tenant.name}" (${tenant.id})`);
  console.log(`📌 API Key usada: "${apiKey.name}" (${apiKey.key.slice(0, 15)}...)`);

  try {
    // -------------------------------------------------------------------------
    // 1. Ajustar Tenant para STARTER (Limite de 50.000 requisições/mês)
    // -------------------------------------------------------------------------
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan: "STARTER" }
    });
    console.log("\n🔹 1. Plano ajustado para [STARTER] (Limite: 50.000 req/mês).");

    // -------------------------------------------------------------------------
    // 2. Inserir 50.000 logs fictícios no mês atual para SIMULAR teto estourado
    // -------------------------------------------------------------------------
    console.log("🔹 2. Simulando consumo de 50.000 requisições no mês atual em lote...");

    const now = new Date();
    const batchSize = 10000;
    const totalSimulated = 50000;

    const dummyLog = {
      tenantId: tenant.id,
      apiKeyId: apiKey.id,
      provider: apiKey.provider,
      model: "gpt-4o-mini",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
      estimatedCost: 0.0001,
      createdAt: now
    };

    for (let i = 0; i < totalSimulated / batchSize; i++) {
      const logs = Array.from({ length: batchSize }, (_, idx) => ({
        ...dummyLog,
        requestId: `test_limit_${i}_${idx}_${Date.now()}`
      }));

      await prisma.usageLog.createMany({
        data: logs
      });
      console.log(`   └─ Simulados ${ (i + 1) * batchSize } / ${totalSimulated} logs.`);
    }

    const currentCount = await prisma.usageLog.count({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
      }
    });
    console.log(`\n📊 Total de requisições no mês atual: ${currentCount.toLocaleString('pt-BR')}`);

    // -------------------------------------------------------------------------
    // 3. Testar a requisição no endpoint /collector (Esperado: HTTP 429)
    // -------------------------------------------------------------------------
    console.log("\n🔹 3. Enviando requisição ao endpoint /collector com teto atingido...");

    const resCollector = await fetch("http://localhost:3000/collector", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.key
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 100,
        completionTokens: 50
      })
    });

    const bodyCollector = await resCollector.json() as any;

    console.log(`\n📬 Resposta da API:`);
    console.log(`   Status HTTP: ${resCollector.status}`);
    console.log(`   Payload:`, bodyCollector);

    if (resCollector.status === 429) {
      console.log("\n✅ SUCESSO: Endpoint bloqueou a requisição com HTTP 429 Too Many Requests!");
      console.log(`   Mensagem recebida: "${bodyCollector.error}"`);
    } else {
      console.error(`\n❌ FALHA: Esperado HTTP 429, mas recebeu HTTP ${resCollector.status}`);
    }

  } catch (err) {
    console.error("❌ Erro durante o teste de limite de requisição:", err);
  } finally {
    // -------------------------------------------------------------------------
    // 4. Limpeza dos logs fictícios e restauração do plano original
    // -------------------------------------------------------------------------
    console.log("\n---------------------------------------------------------------");
    console.log("🧹 Efetuando limpeza dos 50.000 logs de teste inseridos...");
    const deleteResult = await prisma.usageLog.deleteMany({
      where: {
        tenantId: tenant.id,
        requestId: { startsWith: "test_limit_" }
      }
    });
    console.log(`✅ Removidos ${deleteResult.count.toLocaleString('pt-BR')} logs de teste.`);

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

testMonthlyRequestLimit();
