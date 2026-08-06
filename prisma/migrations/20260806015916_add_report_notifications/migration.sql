-- AlterTable
ALTER TABLE "public"."Notification" ADD COLUMN     "reportScheduleId" TEXT,
ALTER COLUMN "alertConfigId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_reportScheduleId_idx" ON "public"."Notification"("reportScheduleId");

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_reportScheduleId_fkey" FOREIGN KEY ("reportScheduleId") REFERENCES "public"."ReportSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
