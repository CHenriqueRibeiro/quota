/*
  Warnings:

  - Added the required column `updatedAt` to the `FailedUsage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."FailedUsage" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "FailedUsage_status_idx" ON "public"."FailedUsage"("status");

-- CreateIndex
CREATE INDEX "FailedUsage_createdAt_idx" ON "public"."FailedUsage"("createdAt");
