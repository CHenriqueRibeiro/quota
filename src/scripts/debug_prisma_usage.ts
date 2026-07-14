import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const logPath = path.resolve('debug-prisma.log');
const append = (msg: string) => {
  fs.appendFileSync(logPath, `${msg}\n`);
};

async function main() {
  append('start');
  await prisma.$connect();
  append('connected');

  const tenantId = `dbg-${Date.now()}`;
  try {
    const tenant = await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: {
        id: tenantId,
        name: tenantId,
        slug: tenantId,
        plan: 'STARTER',
        isActive: true,
      },
    });
    append(`tenant ok ${tenant.id}`);
  } catch (err) {
    append(`tenant failed ${String(err)}`);
    return;
  }

  try {
    const usage = await prisma.usageLog.create({
      data: {
        tenantId,
        model: 'debug-model',
        provider: 'debug-provider' as any,
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        estimatedCost: 0.01,
      },
    });
    append(`usage ok ${usage.id}`);
  } catch (err) {
    append(`usage failed ${String(err)}`);
  }

  await prisma.$disconnect();
  append('done');
}

main().catch(err => {
  append(`fatal ${String(err)}`);
});
