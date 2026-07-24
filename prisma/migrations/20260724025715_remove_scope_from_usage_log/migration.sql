/*
  Warnings:

  - You are about to drop the column `scopeId` on the `usage_logs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."usage_logs" DROP CONSTRAINT "usage_logs_scopeId_fkey";

-- DropIndex
DROP INDEX "public"."usage_logs_scopeId_idx";

-- DropIndex
DROP INDEX "public"."usage_logs_tenantId_scopeId_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."usage_logs" DROP COLUMN "scopeId";
