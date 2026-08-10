-- CreateTable
CREATE TABLE "public"."bi_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Dashboard BI Personalizado',
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tabsConfig" JSONB NOT NULL,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bi_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bi_reports_tenantId_idx" ON "public"."bi_reports"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."bi_reports" ADD CONSTRAINT "bi_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
