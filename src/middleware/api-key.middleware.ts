import type { FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../types/auth';

export const validateApiKey = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  const apiKey = request.headers['x-api-key'];

  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return reply.status(401).send({
      error: 'API Key ausente ou inválida. Não foi possível gravar os dados de consumo.'
    });
  }

  const keyRecord = await prisma.apiKey.findFirst({
    where: {
      key: apiKey,
      isActive: true
    },
    select: {
      id: true,
      key: true,
      name: true,
      tenantId: true,
      provider: true,
      providerCredentialId: true,
      allowedModels: true
    }
  });

  if (!keyRecord) {
    return reply.status(401).send({
      error: 'Chave de API não cadastrada ou inexistente no ambiente. Não foi possível gravar os dados de consumo.'
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