/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,provider]` on the table `provider_credentials` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "provider_credentials_tenantId_provider_key" ON "public"."provider_credentials"("tenantId", "provider");
