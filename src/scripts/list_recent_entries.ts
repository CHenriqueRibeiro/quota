import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
    const apiKeys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
    const usage = await prisma.usageLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
