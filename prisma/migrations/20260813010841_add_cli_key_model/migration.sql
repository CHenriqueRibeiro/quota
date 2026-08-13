-- CreateTable
CREATE TABLE "public"."cli_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "description" TEXT,
    "agent" TEXT,
    "project" TEXT,
    "billingGroup" TEXT,
    "environment" TEXT,
    "tags" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cli_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cli_keys_key_key" ON "public"."cli_keys"("key");

-- CreateIndex
CREATE INDEX "cli_keys_tenantId_idx" ON "public"."cli_keys"("tenantId");

-- CreateIndex
CREATE INDEX "cli_keys_key_idx" ON "public"."cli_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "cli_keys_userId_name_key" ON "public"."cli_keys"("userId", "name");

-- AddForeignKey
ALTER TABLE "public"."cli_keys" ADD CONSTRAINT "cli_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cli_keys" ADD CONSTRAINT "cli_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
