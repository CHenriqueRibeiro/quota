-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('DETAILED_LOGS', 'OVERVIEW_DASHBOARD', 'BOTH');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'HTML', 'BOTH');

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "time" TEXT NOT NULL DEFAULT '08:00',
    "email" TEXT NOT NULL,
    "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reportType" "ReportType" NOT NULL DEFAULT 'BOTH',
    "format" "ReportFormat" NOT NULL DEFAULT 'BOTH',
    "billingGroupId" TEXT,
    "project" TEXT,
    "agent" TEXT,
    "provider" "ProviderName",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSchedule_tenantId_idx" ON "ReportSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "ReportSchedule_enabled_idx" ON "ReportSchedule"("enabled");

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "billing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
