import "dotenv/config";
import { prisma } from "../lib/prisma";
import { triggerAlert } from "../service/alert.service";

console.log("=== Testando Envio de Alerta com Cópia (CC) ===");

const tenant = await prisma.tenant.findFirst();

if (!tenant) {
  throw new Error("Nenhum tenant encontrado no banco de dados.");
}

// Cria ou busca uma configuração de teste com CC para lavajaapp@gmail.com
let alertConfig = await prisma.alertConfig.findFirst({
  where: {
    tenantId: tenant.id,
    email: "chmr66@gmail.com",
  },
});

if (alertConfig) {
  alertConfig = await prisma.alertConfig.update({
    where: { id: alertConfig.id },
    data: {
      ccEmails: ["lavajaapp@gmail.com"],
      quietHoursEnabled: false, // Garante que vai disparar o e-mail agora
      lastTriggeredAt: null, // Força o envio sem ser bloqueado por período
    },
  });
} else {
  alertConfig = await prisma.alertConfig.create({
    data: {
      tenantId: tenant.id,
      type: "COST",
      period: "REQUEST",
      threshold: 1,
      email: "chmr66@gmail.com",
      ccEmails: ["lavajaapp@gmail.com"],
      quietHoursEnabled: false,
    },
  });
}

console.log(`AlertConfig ID: ${alertConfig.id}`);
console.log(`E-mail Principal: ${alertConfig.email}`);
console.log(`E-mails em Cópia: ${JSON.stringify(alertConfig.ccEmails)}`);

// Dispara o alerta
const result = await triggerAlert({
  alertConfigId: alertConfig.id,
  title: "Teste de Alerta com CC",
  message: "Este e-mail é um teste de notificação do Quota enviado com cópia para lavajaapp@gmail.com.",
});

console.log("Resultado da Notificação:", result);
console.log("✅ Teste finalizado com sucesso!");
process.exit(0);
