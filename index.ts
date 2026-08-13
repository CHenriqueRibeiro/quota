import 'dotenv/config';
import cors from '@fastify/cors';
import Fastify, { type FastifyError } from 'fastify';
import { prisma } from "./src/lib/prisma";
import fastifyStatic from '@fastify/static';
import path from 'path';
import multipart from "@fastify/multipart";

import { redis } from './src/lib/redis';
import { tenantRoutes } from './src/routes/tentant.routes';
import { authRoutes } from './src/routes/auth.routes';
import { userRoutes } from './src/routes/user.routes';
import { proxyRoutes } from './src/routes/proxy.routes';
import { collectorRoutes } from './src/routes/collector.routes';
import { billingRoutes } from './src/routes/billing.routes';
import { failedUsageRoutes } from './src/routes/failedUsage.routes';
import { analyticsRoutes } from './src/routes/analytics.routes';
import { alertRoutes } from './src/routes/alert.routes';
import { scopeRoutes } from './src/routes/scope.routes';
import { homeRoutes } from './src/routes/home.routes';
import { assistantRoutes } from './src/routes/assistant.routes';
import { topicRoutes } from './src/routes/topic.routes';
import { widgetRoutes } from "./src/routes/widget.routes";
import { widgetChatRoutes } from "./src/routes/widget-chat.routes";
import { widgetUploadRoutes } from "./src/routes/widget-upload.routes";
import { projectManagementRoutes } from "./src/routes/project-management.routes";
import { agentManagementRoutes } from "./src/routes/agent-management.routes";
import { tagManagementRoutes } from "./src/routes/tag-management.routes";
import { budgetRoutes } from "./src/routes/budget.routes";
import { llmPricingRoutes } from "./src/routes/llm-pricing.routes";
import { reportsRoutes } from "./src/routes/reports.routes";
import { auditRoutes } from "./src/routes/audit.routes";
import { cliTelemetryRoutes } from "./src/routes/cli-telemetry.routes";
import { cliKeyRoutes } from "./src/routes/cli-key.routes";
import llmPricingService from "./src/service/llm-pricing.service";
import reportsService from "./src/service/reports.service";
import pruningService from "./src/service/pruning.service";

const isProduction = process.env.NODE_ENV === 'production';


const server = Fastify({
  logger: isProduction ? { level: 'info' } : true,
  bodyLimit: 20 * 1024 * 1024,
  keepAliveTimeout: 65000,
  requestTimeout: 30000,
  trustProxy: true,
});

server.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (reply.sent) return;
  const err = error as FastifyError;
  const statusCode = err.statusCode ?? 500;
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : err.message,
  });
});


const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;

    await server.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-system-secret', 'x-api-key', 'x-cli-key'],
    });

    await server.register(multipart);

    await server.register(fastifyStatic, {
      root: path.join(process.cwd(), 'public'),
    });


    await server.register(tenantRoutes);
    await server.register(authRoutes);
    await server.register(userRoutes);
    await server.register(proxyRoutes);
    await server.register(collectorRoutes);
    await server.register(billingRoutes);
    await server.register(failedUsageRoutes);
    await server.register(analyticsRoutes);
    await server.register(alertRoutes);
    await server.register(scopeRoutes);
    await server.register(homeRoutes);
    await server.register(assistantRoutes);
    await server.register(topicRoutes);
    await server.register(widgetRoutes);
    await server.register(widgetChatRoutes);
    await server.register(widgetUploadRoutes);
    await server.register(projectManagementRoutes);
    await server.register(agentManagementRoutes);
    await server.register(tagManagementRoutes);
    await server.register(budgetRoutes);
    await server.register(llmPricingRoutes);
    await server.register(reportsRoutes);
    await server.register(auditRoutes);
    await server.register(cliTelemetryRoutes);
    await server.register(cliKeyRoutes);

    // Inicializa / Garante sincronização dos preços das LLMs (llm-prices.com) a cada 5 dias
    llmPricingService.ensureFreshPrices().catch((err) => {
      server.log.error('Erro ao sincronizar preços de LLM na inicialização:', err);
    });

    // Inicia agendador automático de relatórios por e-mail em segundo plano (a cada 60s)
    setInterval(() => {
      reportsService.processDueReportSchedules().catch((err) => {
        server.log.error('Erro no agendador de relatórios:', err);
      });
    }, 60 * 1000);

    // Inicia expurgo físico diário de logs antigos (Executa à noite - 23:00 PM)
    setInterval(() => {
      const currentHour = new Date().getHours();
      if (currentHour === 23) {
        pruningService.pruneExpiredLogs().catch((err) => {
          server.log.error('Erro no expurgo diário de logs antigos:', err);
        });
      }
    }, 60 * 60 * 1000);





    await prisma.$connect();
    server.log.info('Conexão com o PostgreSQL via Prisma estabelecida com sucesso.');

    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN'`);
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER'`);
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ANALYST'`);
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEV'`);
    } catch (e) {
      server.log.warn({ err: e }, 'Aviso ao sincronizar enum Role no PostgreSQL');
    }


    const redisStatus = await redis.ping();
    server.log.info(`Redis status: ${redisStatus}`);


    await server.listen({
      port,
      host: '0.0.0.0',
    });


    console.log(`\nServidor rodando na porta ${port}\n`);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};


const gracefulShutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await server.close();
    await prisma.$disconnect();

    try {
      await (redis as any).quit();
    } catch {
      try {
        (redis as any).disconnect();
      } catch {}
    }

    process.exit(0);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};


process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => server.log.error(reason));


start();