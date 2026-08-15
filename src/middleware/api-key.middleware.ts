import type { FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import type { AuthenticatedRequest } from '../types/auth';

export const validateApiKey = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  const headerKey = request.headers['x-api-key'];
  const authHeader = request.headers['authorization'];
  const apiKey = typeof headerKey === 'string' && headerKey.trim() !== ''
    ? headerKey
    : typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!apiKey) {
    return reply.status(401).send({
      error: 'API Key ausente ou inválida. Não foi possível gravar os dados de consumo.'
    });
  }

  const cleanKey = apiKey.trim();

  // Verificação em cache Redis (TTL 5 min) para economizar consultas ao Postgres em alta taxa de requisições
  const cacheKey = `apikey:cache:${cleanKey}`;
  let keyRecord: any = null;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      keyRecord = JSON.parse(cached);
    }
  } catch {
    // fallback para banco de dados caso Redis oscile
  }

  if (!keyRecord) {
    keyRecord = await prisma.apiKey.findUnique({
      where: {
        key: cleanKey,
      },
      select: {
        id: true,
        key: true,
        name: true,
        tenantId: true,
        provider: true,
        providerCredentialId: true,
        allowedModels: true,
        isActive: true,
      },
    });

    if (keyRecord && keyRecord.isActive) {
      try {
        await redis.set(cacheKey, JSON.stringify(keyRecord), 'EX', 300);
      } catch {
        // silencia falha de cache
      }
    }
  }

  if (!keyRecord || !keyRecord.isActive) {
    return reply.status(401).send({
      error: 'Chave de API não cadastrada, inativa ou inexistente no ambiente.'
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
    allowedModels: keyRecord.allowedModels as string[] | null,
  };
};