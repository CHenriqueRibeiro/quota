import { PrismaClient } from "@prisma/client";
import reportsService from "../service/reports.service";

const prisma = new PrismaClient();

let isProcessing = false;

async function runReportsCycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    console.log(`[Reports Worker] Executando verificação de agendamentos em ${now.toLocaleString("pt-BR")}...`);
    await reportsService.processDueReportSchedules();
  } catch (error) {
    console.error("[Reports Worker] Erro durante o ciclo de verificação:", error);
  } finally {
    isProcessing = false;
  }
}

// Inicia o loop em segundo plano a cada 60 segundos
console.log("🚀 [Reports Worker] Iniciado em segundo plano! Checando agendamentos a cada 60 segundos...");
setInterval(runReportsCycle, 60 * 1000);

// Executa o primeiro ciclo imediatamente na inicialização
runReportsCycle();
