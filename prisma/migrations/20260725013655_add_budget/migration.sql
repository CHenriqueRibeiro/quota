-- CreateTable
CREATE TABLE "public"."Budget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingGroupId" TEXT,
    "agent" TEXT,
    "project" TEXT,
    "limit" DOUBLE PRECISION NOT NULL,
    "period" "public"."AlertPeriod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Budget_tenantId_idx" ON "public"."Budget"("tenantId");

-- CreateIndex
CREATE INDEX "Budget_billingGroupId_idx" ON "public"."Budget"("billingGroupId");

-- CreateIndex
CREATE INDEX "Budget_agent_idx" ON "public"."Budget"("agent");

-- CreateIndex
CREATE INDEX "Budget_project_idx" ON "public"."Budget"("project");

-- AddForeignKey
ALTER TABLE "public"."Budget" ADD CONSTRAINT "Budget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Budget" ADD CONSTRAINT "Budget_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "public"."billing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
