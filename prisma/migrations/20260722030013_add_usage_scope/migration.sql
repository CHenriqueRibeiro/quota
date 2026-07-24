-- AlterTable
ALTER TABLE "public"."usage_logs" ADD COLUMN     "scopeId" TEXT;

-- CreateIndex
CREATE INDEX "usage_logs_scopeId_idx" ON "public"."usage_logs"("scopeId");

-- CreateIndex
CREATE INDEX "usage_logs_tenantId_scopeId_createdAt_idx" ON "public"."usage_logs"("tenantId", "scopeId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."usage_logs" ADD CONSTRAINT "usage_logs_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "public"."Scope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
