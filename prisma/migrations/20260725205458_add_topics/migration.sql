-- CreateTable
CREATE TABLE "public"."Topic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assistantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "questions" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Topic_tenantId_idx" ON "public"."Topic"("tenantId");

-- CreateIndex
CREATE INDEX "Topic_assistantId_idx" ON "public"."Topic"("assistantId");

-- AddForeignKey
ALTER TABLE "public"."Topic" ADD CONSTRAINT "Topic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Topic" ADD CONSTRAINT "Topic_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "public"."Assistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
