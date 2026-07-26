-- CreateEnum
CREATE TYPE "public"."AssistantType" AS ENUM ('GENERAL', 'FINANCE', 'OPERATIONS', 'SUPPORT', 'SALES', 'CUSTOM');

-- CreateTable
CREATE TABLE "public"."Assistant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."AssistantType" NOT NULL DEFAULT 'CUSTOM',
    "provider" "public"."ProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assistant_tenantId_idx" ON "public"."Assistant"("tenantId");

-- CreateIndex
CREATE INDEX "Assistant_scopeId_idx" ON "public"."Assistant"("scopeId");

-- CreateIndex
CREATE INDEX "Assistant_enabled_idx" ON "public"."Assistant"("enabled");

-- CreateIndex
CREATE INDEX "Assistant_type_idx" ON "public"."Assistant"("type");

-- AddForeignKey
ALTER TABLE "public"."Assistant" ADD CONSTRAINT "Assistant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assistant" ADD CONSTRAINT "Assistant_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "public"."Scope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
