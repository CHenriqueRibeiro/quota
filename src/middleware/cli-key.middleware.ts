import type { FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../types/auth';

export const validateCliKey = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization;
  let key: string | null = null;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    key = authHeader.substring(7).trim();
  } else if (typeof request.headers['x-cli-key'] === 'string') {
    key = request.headers['x-cli-key'].trim();
  }

  if (!key || key === '') {
    return reply.status(401).send({
      error: 'Chave de CLI ausente. Forneça o header Authorization: Bearer qcli_... ou x-cli-key.'
    });
  }

  const cliKeyRecord = await prisma.cliKey.findFirst({
    where: {
      key,
      isActive: true
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          scopeId: true
        }
      }
    }
  });

  if (!cliKeyRecord) {
    return reply.status(401).send({
      error: 'Chave de CLI desativada ou não cadastrada.'
    });
  }

  request.tenantId = cliKeyRecord.tenantId;

  request.user = {
    id: cliKeyRecord.user.id,
    name: cliKeyRecord.user.name,
    email: cliKeyRecord.user.email,
    role: cliKeyRecord.user.role,
    tenantId: cliKeyRecord.tenantId,
    scopeId: cliKeyRecord.user.scopeId ?? undefined
  };

  request.cliKeyMeta = {
    agent: cliKeyRecord.agent,
    project: cliKeyRecord.project,
    billingGroup: cliKeyRecord.billingGroup,
    environment: cliKeyRecord.environment,
    tags: (cliKeyRecord.tags as string[]) ?? []
  };

  // Atualização assíncrona de último uso
  prisma.cliKey
    .update({
      where: { id: cliKeyRecord.id },
      data: { lastUsedAt: new Date() }
    })
    .catch((err) => {
      request.log.warn({ err }, 'Erro ao atualizar lastUsedAt da CliKey');
    });
};
