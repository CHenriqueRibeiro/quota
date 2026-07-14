/*
  Warnings:

  - The `plan` column on the `tenants` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[tenantId,name]` on the table `api_keys` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerCredentialId` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- DropIndex
DROP INDEX "public"."provider_credentials_tenantId_provider_key";

-- AlterTable
ALTER TABLE "public"."api_keys" ADD COLUMN     "allowedModels" JSONB,
ADD COLUMN     "provider" "public"."ProviderName" NOT NULL,
ADD COLUMN     "providerCredentialId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."provider_credentials" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "public"."quotas" ADD COLUMN     "lastResetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."tenants" DROP COLUMN "plan",
ADD COLUMN     "plan" "public"."Plan" NOT NULL DEFAULT 'STARTER';

-- AlterTable
ALTER TABLE "public"."usage_logs" ADD COLUMN     "apiKeyId" TEXT;

-- CreateIndex
CREATE INDEX "api_keys_tenantId_idx" ON "public"."api_keys"("tenantId");

-- CreateIndex
CREATE INDEX "api_keys_provider_idx" ON "public"."api_keys"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_tenantId_name_key" ON "public"."api_keys"("tenantId", "name");

-- CreateIndex
CREATE INDEX "provider_credentials_tenantId_idx" ON "public"."provider_credentials"("tenantId");

-- CreateIndex
CREATE INDEX "provider_credentials_provider_idx" ON "public"."provider_credentials"("provider");

-- CreateIndex
CREATE INDEX "usage_logs_apiKeyId_idx" ON "public"."usage_logs"("apiKeyId");

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_providerCredentialId_fkey" FOREIGN KEY ("providerCredentialId") REFERENCES "public"."provider_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_logs" ADD CONSTRAINT "usage_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
