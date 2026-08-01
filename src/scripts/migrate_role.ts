import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN'`);
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'ADMIN' WHERE role::text = 'OWNER'`);
    console.log("Database SQL enum migration completed!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
