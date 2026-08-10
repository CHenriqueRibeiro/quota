-- AlterTable
ALTER TABLE "public"."bi_reports" ADD COLUMN "shareToken" TEXT,
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicExpiresAt" TIMESTAMP(3),
ADD COLUMN "isRevoked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduleEmail" TEXT,
ADD COLUMN "scheduleCc" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "scheduleFrequency" TEXT,
ADD COLUMN "scheduleDayOfWeek" INTEGER,
ADD COLUMN "scheduleDayOfMonth" INTEGER,
ADD COLUMN "scheduleTime" TEXT,
ADD COLUMN "lastSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "bi_reports_shareToken_key" ON "public"."bi_reports"("shareToken");

-- CreateIndex
CREATE INDEX "bi_reports_shareToken_idx" ON "public"."bi_reports"("shareToken");
