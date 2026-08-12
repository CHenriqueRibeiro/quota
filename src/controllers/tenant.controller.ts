import type { FastifyRequest, FastifyReply } from 'fastify';
import { Plan } from '@prisma/client';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { SUPPORTED_PROVIDERS, type SupportedProvider } from '../lib/providers';
import type { AuthenticatedRequest } from '../types/auth';
import auditService from '../service/audit.service';

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
  }  async generateApiKey(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      const body = (request.body as any) || {};
      const { name, providerCredentialId, allowedModels } = body;
      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const bodyTenantId = body?.tenantId;
      const resolvedTenantId = (paramTenantId || queryTenantId || bodyTenantId || actor?.tenantId)?.trim();

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (actor && actor.role !== 'ADMIN' && actor.tenantId !== resolvedTenantId) {
        return reply.status(403).send({ error: 'Você não tem permissão para gerar API keys para este tenant' });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: resolvedTenantId }
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Ambiente não encontrado' });
      }

      const PLAN_API_KEY_LIMITS = {
        STARTER: 3,
        PRO: 10,
        ENTERPRISE: 30
      } as const;

      const currentKeys = await prisma.apiKey.count({
        where: { tenantId: resolvedTenantId }
      });

      const maxKeys = PLAN_API_KEY_LIMITS[tenant.plan as keyof typeof PLAN_API_KEY_LIMITS];

      if (currentKeys >= maxKeys) {
        return reply.status(400).send({
          error: `Seu plano ${tenant.plan} permite apenas ${maxKeys} API keys`
        });
      }

      const credential = await prisma.providerCredential.findFirst({
        where: {
          id: providerCredentialId,
          tenantId: resolvedTenantId,
          isActive: true
        }
      });

      if (!credential) {
        return reply.status(400).send({
          error: 'Provider credential inválida ou não pertence ao tenant'
        });
      }

      const apiKeyString = `quota_live_${crypto.randomBytes(24).toString('hex')}`;

      const apiKey = await prisma.apiKey.create({
        data: {
          key: apiKeyString,
          name: name?.trim() || 'default',
          tenantId: resolvedTenantId,
          provider: credential.provider,
          providerCredentialId: credential.id,
          allowedModels,
        }
      });

      await auditService.logEvent({
        tenantId: resolvedTenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'CREDENTIALS',
        action: 'API_KEY_CREATE',
        actionTitle: `Chave de API "${apiKey.name}" Gerada`,
        details: `Nova chave de API corporativa "${apiKey.name}" gerada para o provedor ${credential.provider.toUpperCase()}`,
        metadata: { apiKeyId: apiKey.id, name: apiKey.name, provider: credential.provider }
      });

      return reply.status(201).send({
        message: 'API key criada com sucesso',
        apiKey: {
          id: apiKey.id,
          key: apiKey.key,
          name: apiKey.name,
          provider: apiKey.provider,
          allowedModels: apiKey.allowedModels,
          isActive: apiKey.isActive
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(400).send({
        error: 'Erro ao criar API key',
        details: error instanceof Error ? error.message : error
      });
    }
  }

  async listApiKeys(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const resolvedTenantId = (paramTenantId || queryTenantId || actor?.tenantId)?.trim();

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (actor && actor.role !== 'ADMIN' && actor.tenantId !== resolvedTenantId) {
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
      const body = (request.body as any) || {};
      const { provider, apiKey, baseUrl, isActive } = body;
      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const bodyTenantId = body?.tenantId;
      const resolvedTenantId = (paramTenantId || queryTenantId || bodyTenantId || actor?.tenantId)?.trim();

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (actor && actor.role !== 'ADMIN' && actor.tenantId !== resolvedTenantId) {
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

      await auditService.logEvent({
        tenantId: resolvedTenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'CREDENTIALS',
        action: 'CREDENTIAL_UPDATE',
        actionTitle: `Credencial de IA (${provider.toUpperCase()}) Atualizada`,
        details: `Credenciais e chave de API do provedor ${provider.toUpperCase()} salvas no cofre seguro.`,
        metadata: { provider: credential.provider, credentialId: credential.id }
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
      const paramTenantId = (request.params as any)?.tenantId;
      const queryTenantId = (request.query as any)?.tenantId;
      const resolvedTenantId = (paramTenantId || queryTenantId || actor?.tenantId)?.trim();

      if (!resolvedTenantId) {
        return reply.status(400).send({ error: 'tenantId é obrigatório' });
      }

      if (actor && actor.role !== 'ADMIN' && actor.tenantId !== resolvedTenantId) {
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

  async deleteProviderCredential(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      const { id } = (request.params as any) || {};

      if (!id) {
        return reply.status(400).send({ error: 'id é obrigatório' });
      }

      const credential = await prisma.providerCredential.findUnique({
        where: { id },
      });

      if (!credential) {
        return reply.status(404).send({ error: 'Credencial não encontrada' });
      }

      if (actor && actor.role !== 'ADMIN' && actor.tenantId !== credential.tenantId) {
        return reply.status(403).send({ error: 'Sem permissão para este tenant' });
      }

      await prisma.providerCredential.delete({
        where: { id },
      });

      await auditService.logEvent({
        tenantId: credential.tenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'CREDENTIALS',
        action: 'CREDENTIAL_DELETE',
        actionTitle: `Credencial de IA (${credential.provider.toUpperCase()}) Excluída`,
        details: `Credencial do provedor ${credential.provider.toUpperCase()} removida`,
        metadata: { provider: credential.provider, credentialId: credential.id }
      });

      return reply.status(200).send({ message: 'Credencial excluída com sucesso' });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao excluir credencial do provedor' });
    }
  }

  async deleteApiKey(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      const { id } = (request.params as any) || {};

      if (!id) {
        return reply.status(400).send({ error: 'id é obrigatório' });
      }

      const apiKey = await prisma.apiKey.findUnique({
        where: { id },
      });

      if (!apiKey) {
        return reply.status(404).send({ error: 'Chave de API não encontrada' });
      }

      if (actor && actor.role !== 'ADMIN' && actor.tenantId !== apiKey.tenantId) {
        return reply.status(403).send({ error: 'Sem permissão para este tenant' });
      }

      await prisma.apiKey.delete({
        where: { id },
      });

      await auditService.logEvent({
        tenantId: apiKey.tenantId,
        userId: actor?.id,
        userName: actor?.name,
        userEmail: actor?.email,
        userRole: actor?.role,
        category: 'CREDENTIALS',
        action: 'API_KEY_DELETE',
        actionTitle: `Chave de API "${apiKey.name}" Revogada`,
        details: `Chave de API corporativa "${apiKey.name}" excluída`,
        metadata: { apiKeyId: apiKey.id, name: apiKey.name }
      });

      return reply.status(200).send({ message: 'Chave de API excluída com sucesso' });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao excluir chave de API' });
    }
  }

  async updatePlan(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const actor = request.user;
      if (!actor) return reply.status(401).send({ error: 'Unauthorized' });

      const { tenantId } = (request.params as any) || {};
      const { plan } = (request.body as any) || {};

      const targetTenantId = tenantId || actor.tenantId;

      if (actor.role !== 'ADMIN' && actor.tenantId !== targetTenantId) {
        return reply.status(403).send({ error: 'Sem permissão para este tenant' });
      }

      if (!plan || !['STARTER', 'PRO', 'ENTERPRISE'].includes(plan)) {
        return reply.status(400).send({ error: 'Plano inválido (STARTER, PRO, ENTERPRISE)' });
      }

      const updated = await prisma.tenant.update({
        where: { id: targetTenantId },
        data: { plan }
      });

      await auditService.logEvent({
        tenantId: targetTenantId,
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        userRole: actor.role,
        category: 'PLAN_CHANGE',
        action: 'PLAN_UPDATE',
        actionTitle: `Mudança de Plano (${plan})`,
        details: `Plano da organização alterado para ${plan}`,
        metadata: { plan }
      });

      return reply.status(200).send({ message: 'Plano atualizado com sucesso', tenant: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Erro ao atualizar plano' });
    }
  }
}
