import { ProviderName, AssistantType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedUser } from "../types/auth";
import { getPlanLimits } from "../config/plan-limits";

interface CreateAssistantBody {


  name: string;

  description?: string;

  type: AssistantType;

  apiKeyId: string;

  model: string;

  systemPrompt: string;

  temperature?: number;

  maxTokens?: number;

  enabled?: boolean;

  scopeId?: string;

  isDefault?: boolean;

  sortOrder?: number;

}

class AssistantService {

  async create(
  user: AuthenticatedUser,
  data: CreateAssistantBody
){
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { plan: true }
  });
  const currentCount = await prisma.assistant.count({ where: { tenantId: user.tenantId } });
  const limits = getPlanLimits(tenant?.plan);
  if (currentCount >= limits.maxAssistants) {
    throw new Error(
      `Limite de ${limits.maxAssistants} assistente(s) atingido para o plano ${tenant?.plan ?? 'STARTER'}. Faça upgrade para criar mais assistentes.`
    );
  }

  if(!data.name?.trim()){
    throw new Error(
      "Nome é obrigatório."
    );
  }

  if(!data.systemPrompt?.trim()){
    throw new Error(
      "Prompt do sistema é obrigatório."
    );
  }

  const cleanApiKeyId = typeof data.apiKeyId === 'string' && data.apiKeyId.trim() !== '' && data.apiKeyId !== 'none'
    ? data.apiKeyId.trim()
    : null;

  if(!cleanApiKeyId){
    throw new Error(
      "API Key é obrigatória."
    );
  }

  const cleanScopeId = typeof data.scopeId === 'string' && data.scopeId.trim() !== '' && data.scopeId !== 'none'
    ? data.scopeId.trim()
    : null;

  if(cleanScopeId){
    const scope =
      await prisma.scope.findFirst({
        where:{
          id: cleanScopeId,
          tenantId: user.tenantId
        }
      });

    if(!scope){
      throw new Error(
        "Scope não encontrado."
      );
    }
  }

  const apiKey =
    await prisma.apiKey.findFirst({
      where:{
        id: cleanApiKeyId,
        tenantId: user.tenantId,
        isActive: true
      }
    });

  if(!apiKey){
    throw new Error(
      "API Key não encontrada."
    );
  }

  if(data.isDefault){
    await prisma.assistant.updateMany({
      where:{
        tenantId: user.tenantId,
        isDefault: true
      },
      data:{
        isDefault: false
      }
    });
  }

  const defaultModel = apiKey.provider === 'anthropic' ? 'claude-3-5-sonnet-20241022'
    : apiKey.provider === 'google' ? 'gemini-1.5-flash'
    : apiKey.provider === 'groq' ? 'llama-3.3-70b-versatile'
    : apiKey.provider === 'mistral' ? 'mistral-large-latest'
    : 'gpt-4o-mini';

  const chosenModel = data.model?.trim() ? data.model.trim() : defaultModel;

  const assistant =
    await prisma.assistant.create({
      data:{
        tenantId: user.tenantId,
        scopeId: cleanScopeId,
        apiKeyId: cleanApiKeyId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        type: data.type || "CUSTOM",
        provider: apiKey.provider,
        model: chosenModel,
        systemPrompt: data.systemPrompt,
        temperature:
          data.temperature !== undefined && data.temperature !== null ? Number(data.temperature) : 0.2,
        maxTokens:
          data.maxTokens !== undefined && data.maxTokens !== null ? Number(data.maxTokens) : 4096,
        enabled:
          data.enabled ?? true,
        isDefault:
          data.isDefault ?? false,
        sortOrder:
          data.sortOrder ?? 0
      }
    });

  return assistant;
}

  async list(
  user: AuthenticatedUser
){
  const scopeWhere: any = {};
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.scopeId) {
    scopeWhere.OR = [
      { scopeId: user.scopeId },
      { scopeId: null }
    ];
  }

  const assistants =
    await prisma.assistant.findMany({
      where:{
        tenantId: user.tenantId,
        ...scopeWhere
      },
      select:{
        id: true,
        name: true,
        description: true,
        type: true,
        provider: true,
        model: true,
        systemPrompt: true,
        temperature: true,
        maxTokens: true,
        enabled: true,
        isDefault: true,
        sortOrder: true,
        createdAt: true,
        scopeId: true,
        apiKeyId: true,
        scope:{
          select:{
            id: true,
            name: true
          }
        },
        apiKey:{
          select:{
            id: true,
            name: true,
            provider: true
          }
        }
      },
      orderBy:[
        {
          sortOrder: "asc"
        },
        {
          createdAt: "asc"
        }
      ]
    });

  return assistants;
}

  async listAvailableApiKeys(
    user: AuthenticatedUser
  ){

    const apiKeys =
      await prisma.apiKey.findMany({

        where:{

          tenantId:user.tenantId,

          isActive:true

        },

        select:{

          id:true,

          name:true,

          provider:true

        },

        orderBy:{

          name:"asc"

        }

      });



    return apiKeys;

  }

  async getById(
    user: AuthenticatedUser,
    id: string
  ){

    const assistant =
  await prisma.assistant.findFirst({

    where:{

      id,

      tenantId:user.tenantId

    },

    include:{

      scope:{

        select:{

          id:true,

          name:true,

          description:true

        }

      },

      apiKey:{

        select:{

          id:true,

          name:true,

          provider:true

        }

      },

      Topic:{

        select:{

          id:true,

          name:true,

          category:true,

          enabled:true,

          sortOrder:true

        },

        orderBy:{

          sortOrder:"asc"

        }

      }

    }

  });



    if(!assistant){

      throw new Error(
        "Assistente n\u00e3o encontrado."
      );

    }



    return assistant;

  }

  async update(
    user: AuthenticatedUser,
    id: string,
    data: any
  ){
    const existing =
      await prisma.assistant.findFirst({
        where:{
          id,
          tenantId: user.tenantId
        }
      });

    if(!existing){
      throw new Error(
        "Assistente não encontrado."
      );
    }

    const updateData: any = {};

    if (data.name !== undefined && data.name !== null) {
      const cleanName = String(data.name).trim();
      if (!cleanName) throw new Error("Nome é obrigatório.");
      updateData.name = cleanName;
    }

    if (data.description !== undefined) {
      updateData.description = data.description && String(data.description).trim() ? String(data.description).trim() : null;
    }

    if (data.type !== undefined && data.type !== null) {
      updateData.type = data.type;
    }

    if (data.model !== undefined && data.model !== null) {
      const cleanModel = String(data.model).trim();
      if (cleanModel) updateData.model = cleanModel;
    }

    if (data.systemPrompt !== undefined && data.systemPrompt !== null) {
      const cleanPrompt = String(data.systemPrompt).trim();
      if (!cleanPrompt) throw new Error("Prompt do sistema é obrigatório.");
      updateData.systemPrompt = String(data.systemPrompt);
    }

    if (data.temperature !== undefined && data.temperature !== null && data.temperature !== '') {
      updateData.temperature = Number(data.temperature);
    }

    if (data.maxTokens !== undefined && data.maxTokens !== null && data.maxTokens !== '') {
      updateData.maxTokens = Number(data.maxTokens);
    }

    if (data.enabled !== undefined && data.enabled !== null) {
      updateData.enabled = Boolean(data.enabled);
    }

    if (data.sortOrder !== undefined && data.sortOrder !== null) {
      updateData.sortOrder = Number(data.sortOrder) || 0;
    }

    // Tratamento e Sanitização de Scope
    if (data.scopeId !== undefined) {
      const cleanScopeId = typeof data.scopeId === 'string' && data.scopeId.trim() !== '' && data.scopeId !== 'none'
        ? data.scopeId.trim()
        : null;

      if (cleanScopeId) {
        const scope = await prisma.scope.findFirst({
          where: {
            id: cleanScopeId,
            tenantId: user.tenantId
          }
        });

        if (!scope) {
          throw new Error("Scope não encontrado.");
        }
        updateData.scopeId = cleanScopeId;
      } else {
        updateData.scopeId = null;
      }
    }

    // Tratamento e Sanitização de ApiKey & Provider
    if (data.apiKeyId !== undefined) {
      const cleanApiKeyId = typeof data.apiKeyId === 'string' && data.apiKeyId.trim() !== '' && data.apiKeyId !== 'none'
        ? data.apiKeyId.trim()
        : null;

      if (cleanApiKeyId) {
        const apiKey = await prisma.apiKey.findFirst({
          where: {
            id: cleanApiKeyId,
            tenantId: user.tenantId,
            isActive: true
          }
        });

        if (!apiKey) {
          throw new Error("API Key não encontrada.");
        }
        updateData.apiKeyId = cleanApiKeyId;
        updateData.provider = apiKey.provider;
      } else {
        // Se explicitamente null ou vazio, não altera apiKey se for obrigatório ou desassocia se opcional
        if (cleanApiKeyId === null && data.apiKeyId === null) {
          updateData.apiKeyId = null;
        }
      }
    }

    if (data.provider && !updateData.provider) {
      updateData.provider = data.provider;
    }

    if (data.isDefault) {
      await prisma.assistant.updateMany({
        where: {
          tenantId: user.tenantId,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      });
      updateData.isDefault = true;
    } else if (data.isDefault === false) {
      updateData.isDefault = false;
    }

    const assistant = await prisma.assistant.update({
      where: {
        id
      },
      data: updateData,
      include: {
        scope: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        },
        apiKey: {
          select: {
            id: true,
            name: true,
            provider: true,
          }
        }
      }
    });

    return assistant;
  }

  async delete(
    user: AuthenticatedUser,
    id: string
  ){

    const existing =
      await prisma.assistant.findFirst({

        where:{

          id,

          tenantId:user.tenantId

        }

      });



    if(!existing){

      throw new Error(
        "Assistente n\u00e3o encontrado."
      );

    }



    const assistant =
      await prisma.assistant.delete({

        where:{

          id

        }

      });



    return assistant;

  }

}

export default new AssistantService();
