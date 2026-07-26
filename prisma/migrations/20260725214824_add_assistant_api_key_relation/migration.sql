-- AlterTable
ALTER TABLE "public"."Assistant" ADD COLUMN     "apiKeyId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Assistant" ADD CONSTRAINT "Assistant_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
