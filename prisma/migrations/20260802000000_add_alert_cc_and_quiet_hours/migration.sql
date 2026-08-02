-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'MUTED';

-- AlterTable
ALTER TABLE "AlertConfig" ADD COLUMN "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "quietHoursEnd" TEXT,
ADD COLUMN "quietHoursStart" TEXT,
ADD COLUMN "timezone" TEXT DEFAULT 'America/Sao_Paulo';
