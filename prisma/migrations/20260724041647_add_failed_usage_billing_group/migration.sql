/*
  Warnings:

  - You are about to drop the `failed_usage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."failed_usage" DROP CONSTRAINT "failed_usage_tenantId_fkey";

-- DropTable
DROP TABLE "public"."failed_usage";

-- CreateTable
CREATE TABLE "public"."FailedUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT,
    "traceId" TEXT,
    "billingGroupId" TEXT,
    "provider" "public"."ProviderName",
    "model" TEXT,
    "project" TEXT,
    "agent" TEXT,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedUsage_tenantId_idx" ON "public"."FailedUsage"("tenantId");

-- CreateIndex
CREATE INDEX "FailedUsage_billingGroupId_idx" ON "public"."FailedUsage"("billingGroupId");

-- AddForeignKey
ALTER TABLE "public"."FailedUsage" ADD CONSTRAINT "FailedUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FailedUsage" ADD CONSTRAINT "FailedUsage_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "public"."billing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
