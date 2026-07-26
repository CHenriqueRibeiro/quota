import { PrismaClient, ProviderName, AssistantType } from "@prisma/client";
import type { AuthenticatedUser } from "../types/auth";

const prisma = new PrismaClient();

interface CreateAssistantBody {
  name: string;
  description?: string;

  type: AssistantType;

  provider: ProviderName;
  model: string;

  apiKeyId?: string;

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

    if(!data.name.trim()){

      throw new Error(
        "Nome \u00e9 obrigat\u00f3rio."
      );

    }



    if(!data.systemPrompt.trim()){

      throw new Error(
        "Prompt do sistema \u00e9 obrigat\u00f3rio."
      );

    }



    if(data.scopeId){

      const scope =
        await prisma.scope.findFirst({

          where:{

            id:data.scopeId,

            tenantId:user.tenantId

          }

        });



      if(!scope){

        throw new Error(
          "Scope n\u00e3o encontrado."
        );

      }

    }



    if(data.apiKeyId){

      const apiKey =
        await prisma.apiKey.findFirst({

          where:{

            id:data.apiKeyId,

            tenantId:user.tenantId,

            isActive:true

          }

        });



      if(!apiKey){

        throw new Error(
          "API Key n\u00e3o encontrada."
        );

      }

    }



    if(data.isDefault){

      await prisma.assistant.updateMany({

        where:{

          tenantId:user.tenantId,

          isDefault:true

        },

        data:{

          isDefault:false

        }

      });

    }



    const assistant =
      await prisma.assistant.create({

        data:{

          tenantId:user.tenantId,

          scopeId:data.scopeId,

          apiKeyId:data.apiKeyId,

          name:data.name,

          description:data.description,

          type:data.type,

          provider:data.provider,

          model:data.model,

          systemPrompt:data.systemPrompt,

          temperature:
            data.temperature ?? 0.2,

          maxTokens:
            data.maxTokens ?? 4096,

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

    const assistants =
      await prisma.assistant.findMany({

        where:{

          tenantId:user.tenantId

        },

        include:{

          scope:{

            select:{

              id:true,

              name:true

            }

          }

        },

        orderBy:[

          {

            sortOrder:"asc"

          },

          {

            createdAt:"asc"

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
    data: Partial<CreateAssistantBody>
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



    if(data.scopeId){

      const scope =
        await prisma.scope.findFirst({

          where:{

            id:data.scopeId,

            tenantId:user.tenantId

          }

        });



      if(!scope){

        throw new Error(
          "Scope n\u00e3o encontrado."
        );

      }

    }



    if(data.isDefault){

      await prisma.assistant.updateMany({

        where:{

          tenantId:user.tenantId,

          isDefault:true,

          id:{
            not:id
          }

        },

        data:{

          isDefault:false

        }

      });

    }



    const assistant =
      await prisma.assistant.update({

        where:{

          id

        },

        data:{

          ...data

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
