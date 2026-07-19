-- CreateTable
CREATE TABLE "public"."failed_usage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "traceId" TEXT,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failed_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failed_usage_tenantId_idx" ON "public"."failed_usage"("tenantId");

-- CreateIndex
CREATE INDEX "failed_usage_status_idx" ON "public"."failed_usage"("status");

-- CreateIndex
CREATE INDEX "failed_usage_requestId_idx" ON "public"."failed_usage"("requestId");

-- AddForeignKey
ALTER TABLE "public"."failed_usage" ADD CONSTRAINT "failed_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
