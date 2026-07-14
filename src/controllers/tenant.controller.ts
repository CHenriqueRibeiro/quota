import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Plan } from '@prisma/client';
import crypto from 'crypto';
import { SUPPORTED_PROVIDERS, type SupportedProvider } from '../lib/providers';
import type { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();

export class TenantController {
  
  async createTenant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name, slug, plan } = request.body as {
  name: string;
  slug: string;
  plan?: Plan;
};

      if (!name?.trim() || !slug?.trim()) {
        return reply.status(400).send({ error: 'name e slug são obrigatórios' });
      }

      const normalizedSlug = slug.trim().toLowerCase();
      const existingTenant = await prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
      if (existingTenant) {
        return reply.status(409).send({ error: 'Já existe um ambiente com este slug' });
      }

      const tenant = await prisma.tenant.create({
        data: {
          name: name.trim(),
          slug: normalizedSlug,
          plan: plan ?? Plan.STARTER
        }
      });

      return reply.status(201).send({
        message: 'Ambiente criado com sucesso',
        tenant
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({
        error: 'Erro ao criar ambiente',
        details: error instanceof Error ? error.message : error
      });
    }
  }

 async generateApiKey(request: AuthenticatedRequest, reply: FastifyReply) {

  try {

    const actor = request.user;

    const {
      name,
      providerCredentialId,
      allowedModels
    } = request.body as {
      name?: string;
      providerCredentialId: string;
      allowedModels?: string[];
    };


    const { tenantId } = request.params as {
      tenantId: string;
    };


    const resolvedTenantId = tenantId?.trim();


    if (!resolvedTenantId) {
      return reply.status(400).send({
        error: 'tenantId é obrigatório'
      });
    }


    if (!actor?.tenantId || actor.tenantId !== resolvedTenantId) {
      return reply.status(403).send({
        error: 'Você não tem permissão para gerar API keys para este tenant'
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where:{
        id: resolvedTenantId
      }
    });


    if (!tenant) {
      return reply.status(404).send({
        error:'Ambiente não encontrado'
      });
    }

    const PLAN_API_KEY_LIMITS = {
  STARTER: 3,
  PRO: 10,
  ENTERPRISE: 30
} as const;


    const currentKeys = await prisma.apiKey.count({

      where:{
        tenantId: resolvedTenantId
      }

    });


    const maxKeys = PLAN_API_KEY_LIMITS[tenant.plan as keyof typeof PLAN_API_KEY_LIMITS];


    if(currentKeys >= maxKeys){

      return reply.status(400).send({

        error:`Seu plano ${tenant.plan} permite apenas ${maxKeys} API keys`

      });

    }

    const credential = await prisma.providerCredential.findFirst({

      where:{
        id: providerCredentialId,
        tenantId: resolvedTenantId,
        isActive:true
      }

    });


    if(!credential){

      return reply.status(400).send({

        error:'Provider credential inválida ou não pertence ao tenant'

      });

    }

    const apiKeyString =
      `quota_live_${crypto.randomBytes(24).toString('hex')}`;



    const apiKey = await prisma.apiKey.create({

      data:{

        key: apiKeyString,

        name: name?.trim() || 'default',

        tenantId: resolvedTenantId,

        provider: credential.provider,

        providerCredentialId: credential.id,

        allowedModels,

      }

    });



    return reply.status(201).send({

      message:'API key criada com sucesso',

      apiKey:{

        id: apiKey.id,

        key: apiKey.key,

        name: apiKey.name,

        provider: apiKey.provider,

        allowedModels: apiKey.allowedModels,

        isActive: apiKey.isActive

      }

    });



  } catch(error){

    request.log.error(error);


    return reply.status(400).send({

      error:'Erro ao criar API key',

      details: error instanceof Error ? error.message : error

    });

  }

}

  async listApiKeys(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      const { tenantId } = request.params as { tenantId: string };
      const resolvedTenantId = tenantId?.trim();

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (!actor?.tenantId || actor.tenantId !== resolvedTenantId) {
        return reply.status(403).send({ error: 'Você não tem permissão para listar API keys deste tenant' });
      }

      const apiKeys = await prisma.apiKey.findMany({
        where: { tenantId: resolvedTenantId },
        select: { id: true, name: true, key: true, isActive: true, createdAt: true }
      });

      return reply.status(200).send({ apiKeys });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: 'Erro ao listar API keys' });
    }
  }

  async createProviderCredential(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      const { provider, apiKey, baseUrl, isActive } = request.body as {
        provider?: SupportedProvider;
        apiKey?: string;
        baseUrl?: string;
        isActive?: boolean;
      };
      const { tenantId } = request.params as { tenantId: string };
      const resolvedTenantId = tenantId?.trim();

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (!actor?.tenantId || actor.tenantId !== resolvedTenantId) {
        return reply.status(403).send({ error: 'Você não tem permissão para criar credenciais deste tenant' });
      }

      if (!provider || !SUPPORTED_PROVIDERS.some(item => item.key === provider)) {
        return reply.status(400).send({ error: 'Provider inválido. Use openai, anthropic, google, groq ou mistral' });
      }

      if (!apiKey?.trim()) {
        return reply.status(400).send({ error: 'apiKey é obrigatório' });
      }

      const credential = await prisma.providerCredential.upsert({
        where: {
          tenantId_provider: {
            tenantId: resolvedTenantId,
            provider,
          }
        },
        update: {
          apiKey: apiKey.trim(),
          baseUrl: baseUrl?.trim() || undefined,
          isActive: isActive ?? true,
        },
        create: {
          tenantId: resolvedTenantId,
          provider,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl?.trim(),
          isActive: isActive ?? true,
        }
      });

      return reply.status(201).send({
        message: 'Provider credential criada com sucesso',
        credential: {
          id: credential.id,
          provider: credential.provider,
          baseUrl: credential.baseUrl,
          isActive: credential.isActive,
          createdAt: credential.createdAt,
          updatedAt: credential.updatedAt,
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: 'Erro ao criar credencial de provider' });
    }
  }

  async listProviderCredentials(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      const { tenantId } = request.params as { tenantId: string };
      const resolvedTenantId = tenantId?.trim();

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (!actor?.tenantId || actor.tenantId !== resolvedTenantId) {
        return reply.status(403).send({ error: 'Você não tem permissão para listar credenciais deste tenant' });
      }

      const credentials = await prisma.providerCredential.findMany({
        where: { tenantId: resolvedTenantId },
        select: {
          id: true,
          provider: true,
          baseUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return reply.status(200).send({ credentials });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({ error: 'Erro ao listar credenciais de provider' });
    }
  }
}
