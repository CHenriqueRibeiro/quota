import pruningService from "./src/service/pruning.service";

async function runPruningTest() {
  console.log("===============================================================");
  console.log("🚀 TESTANDO SERVIÇO DE EXPURGO FÍSICO DIÁRIO (PruningService)");
  console.log("===============================================================\n");

  const result = await pruningService.pruneExpiredLogs();
  console.log(`✅ Expurgo concluído! Total de logs antigos removidos: ${result.totalDeleted}`);
  console.log("===============================================================");
}

runPruningTest();
