-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable audit_logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionTitle" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_tenantId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");
CREATE INDEX IF NOT EXISTS "audit_logs_category_idx" ON "audit_logs"("category");
CREATE INDEX IF NOT EXISTS "audit_logs_userEmail_idx" ON "audit_logs"("userEmail");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_level_idx" ON "audit_logs"("level");
