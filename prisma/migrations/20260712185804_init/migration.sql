/*
  Warnings:

  - Changed the type of `provider` on the `usage_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('OWNER', 'MANAGER', 'ANALYST', 'DEV');

-- CreateEnum
CREATE TYPE "public"."ProviderName" AS ENUM ('openai', 'anthropic', 'google', 'groq', 'mistral');

-- AlterTable
ALTER TABLE "public"."tenants" ALTER COLUMN "plan" SET DEFAULT 'STARTER';

-- AlterTable
ALTER TABLE "public"."usage_logs" ADD COLUMN     "agent" TEXT,
ADD COLUMN     "environment" TEXT,
ADD COLUMN     "externalUserId" TEXT,
ADD COLUMN     "latencyMs" INTEGER,
ADD COLUMN     "project" TEXT,
ADD COLUMN     "requestGroup" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "statusCode" INTEGER,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "traceId" TEXT,
DROP COLUMN "provider",
ADD COLUMN     "provider" "public"."ProviderName" NOT NULL,
ALTER COLUMN "estimatedCost" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'ANALYST',
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."provider_credentials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "public"."ProviderName" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "provider_credentials_tenantId_provider_key" ON "public"."provider_credentials"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "quotas_tenantId_key" ON "public"."quotas"("tenantId");

-- CreateIndex
CREATE INDEX "usage_logs_traceId_idx" ON "public"."usage_logs"("traceId");

-- CreateIndex
CREATE INDEX "usage_logs_agent_idx" ON "public"."usage_logs"("agent");

-- CreateIndex
CREATE INDEX "usage_logs_project_idx" ON "public"."usage_logs"("project");

-- CreateIndex
CREATE INDEX "usage_logs_provider_idx" ON "public"."usage_logs"("provider");

-- CreateIndex
CREATE INDEX "usage_logs_model_idx" ON "public"."usage_logs"("model");

-- CreateIndex
CREATE INDEX "usage_logs_externalUserId_idx" ON "public"."usage_logs"("externalUserId");

-- CreateIndex
CREATE INDEX "usage_logs_requestGroup_idx" ON "public"."usage_logs"("requestGroup");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."provider_credentials" ADD CONSTRAINT "provider_credentials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotas" ADD CONSTRAINT "quotas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
