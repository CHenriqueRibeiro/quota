import { prisma } from "../lib/prisma";
import reportsService from "../service/reports.service";
import biReportService from "../service/analytics/bi-report.service";

let isProcessing = false;

function getFortalezaDateTime(): string {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour12: false,
  });
}

async function runReportsCycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    console.log(
      `[Reports Worker] Executando verificação de agendamentos em ${getFortalezaDateTime()}...`
    );

    await reportsService.processDueReportSchedules();
    await biReportService.processDueBiReportSchedules();
  } catch (error) {
    console.error(
      `[Reports Worker] Erro durante o ciclo de verificação em ${getFortalezaDateTime()}:`,
      error
    );
  } finally {
    isProcessing = false;
  }
}


setInterval(runReportsCycle, 60 * 1000);

runReportsCycle();