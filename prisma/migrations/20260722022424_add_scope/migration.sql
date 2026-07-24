-- CreateEnum
CREATE TYPE "public"."ScopeMode" AS ENUM ('FULL', 'CUSTOM');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "scopeId" TEXT;

-- CreateTable
CREATE TABLE "public"."Scope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "public"."ScopeMode" NOT NULL DEFAULT 'CUSTOM',
    "billingGroups" TEXT[],
    "projects" TEXT[],
    "agents" TEXT[],
    "providers" "public"."ProviderName"[],
    "models" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scope_tenantId_idx" ON "public"."Scope"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Scope_tenantId_name_key" ON "public"."Scope"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "public"."Scope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scope" ADD CONSTRAINT "Scope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
