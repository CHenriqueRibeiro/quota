-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'BUDGET';

-- AlterTable
ALTER TABLE "AlertConfig" ADD COLUMN "budgetId" TEXT,
ADD COLUMN "thresholdType" TEXT DEFAULT 'PERCENTAGE';

-- AddForeignKey
ALTER TABLE "AlertConfig" ADD CONSTRAINT "AlertConfig_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
