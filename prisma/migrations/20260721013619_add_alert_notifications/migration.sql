-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."AlertType" AS ENUM ('COST', 'TOKENS', 'LATENCY', 'ERRORS');

-- CreateEnum
CREATE TYPE "public"."AlertPeriod" AS ENUM ('REQUEST', 'DAILY', 'MONTHLY');

-- CreateTable
CREATE TABLE "public"."AlertConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "type" "public"."AlertType" NOT NULL,
    "period" "public"."AlertPeriod" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "email" TEXT NOT NULL,
    "provider" "public"."ProviderName",
    "model" TEXT,
    "billingGroupId" TEXT,
    "project" TEXT,
    "agent" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertConfigId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL,
    "error" TEXT,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertConfig_tenantId_idx" ON "public"."AlertConfig"("tenantId");

-- CreateIndex
CREATE INDEX "AlertConfig_enabled_idx" ON "public"."AlertConfig"("enabled");

-- CreateIndex
CREATE INDEX "AlertConfig_type_idx" ON "public"."AlertConfig"("type");

-- CreateIndex
CREATE INDEX "AlertConfig_provider_idx" ON "public"."AlertConfig"("provider");

-- CreateIndex
CREATE INDEX "AlertConfig_project_idx" ON "public"."AlertConfig"("project");

-- CreateIndex
CREATE INDEX "AlertConfig_agent_idx" ON "public"."AlertConfig"("agent");

-- CreateIndex
CREATE INDEX "AlertConfig_billingGroupId_idx" ON "public"."AlertConfig"("billingGroupId");

-- CreateIndex
CREATE INDEX "AlertConfig_model_idx" ON "public"."AlertConfig"("model");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "public"."Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "public"."Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_status_idx" ON "public"."Notification"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "public"."Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_alertConfigId_idx" ON "public"."Notification"("alertConfigId");

-- AddForeignKey
ALTER TABLE "public"."AlertConfig" ADD CONSTRAINT "AlertConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlertConfig" ADD CONSTRAINT "AlertConfig_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "public"."billing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_alertConfigId_fkey" FOREIGN KEY ("alertConfigId") REFERENCES "public"."AlertConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
