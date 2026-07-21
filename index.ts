import 'dotenv/config';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
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

const prisma = new PrismaClient();

const server = Fastify({
  logger: true,
  bodyLimit: 20 * 1024 * 1024,
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await server.register(cors, {
  origin: true,
  credentials: true,
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

    await prisma.$connect();
    server.log.info('Conexão com o PostgreSQL via Prisma estabelecida com sucesso.');

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