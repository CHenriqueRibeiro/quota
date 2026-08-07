-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_providerCredentialId_fkey";

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_providerCredentialId_fkey" FOREIGN KEY ("providerCredentialId") REFERENCES "provider_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
