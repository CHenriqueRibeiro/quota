import type { FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../types/auth';


export const validateApiKey = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {

  const apiKey = request.headers['x-api-key'];


  if (
    typeof apiKey !== 'string' ||
    apiKey.trim() === ''
  ) {
    return reply.status(401).send({
      error: 'API Key missing or invalid'
    });
  }


  const keyRecord = await prisma.apiKey.findFirst({
  where:{
    key: apiKey,
    isActive:true
  },
  select:{
    id:true,
    key:true,
    name:true,
    tenantId:true,
    provider:true,
    providerCredentialId:true,
    allowedModels:true
  }
});


  if (!keyRecord) {
    const credentialRecord = await prisma.providerCredential.findFirst({
      where: {
        apiKey: apiKey,
        isActive: true
      },
      include: {
        apiKeys: {
          where: { isActive: true },
          take: 1
        }
      }
    });

    if (credentialRecord) {
      const firstApiKey = credentialRecord.apiKeys[0];
      request.tenantId = credentialRecord.tenantId;
      request.apiKey = {
        id: firstApiKey?.id ?? credentialRecord.id,
        key: firstApiKey?.key ?? credentialRecord.apiKey,
        name: firstApiKey?.name ?? `Credential-${credentialRecord.provider}`,
        tenantId: credentialRecord.tenantId,
        provider: credentialRecord.provider as any,
        providerCredentialId: credentialRecord.id,
        allowedModels: (firstApiKey?.allowedModels as string[] | null) ?? null
      };
      return;
    }

    return reply.status(401).send({
      error: 'Invalid API Key'
    });
  }


  request.tenantId = keyRecord.tenantId;


  request.apiKey = {
  id: keyRecord.id,
  key: keyRecord.key,
  name: keyRecord.name,
  tenantId: keyRecord.tenantId,
  provider: keyRecord.provider,
  providerCredentialId: keyRecord.providerCredentialId,
  allowedModels: keyRecord.allowedModels as string[] | null
};

};