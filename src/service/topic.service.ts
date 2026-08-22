import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedUser } from "../types/auth";
import scopeService from "./scope.service";
import DashboardService from "./analytics/dashboard.service";
import { callProvider } from "../lib/provider-client";
import { isSupportedProvider } from "../lib/providers";
import { addUsageJob } from "../lib/queue";
import { parseBrasiliaStartDate, parseBrasiliaEndDate } from "../lib/timezone";

export type TopicAnswer = {
  provider?: any;
  model?: any;
  statusCode?: number;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  content: any;
  raw?: any;
};

type DefaultTopic = {
  key:string;
  name:string;
  description:string;
  category:string;
  questions:string[];
  sortOrder:number;
};

const defaultTopics:DefaultTopic[] = [
  {
    key:"general_usage_summary",
    name:"Resumo de utiliza\u00e7\u00e3o",
    description:"Resumo geral de consumo, custos, tokens, lat\u00eancia e sucesso.",
    category:"GENERAL",
    questions:[
      "Qual foi o resumo de utiliza\u00e7\u00e3o no per\u00edodo?",
      "Quantas requisi\u00e7\u00f5es foram realizadas?",
      "Qual foi o custo total estimado?"
    ],
    sortOrder:10
  },
  {
    key:"general_provider_consumption",
    name:"Consumo por Provider",
    description:"Distribui\u00e7\u00e3o de consumo agrupada por provider.",
    category:"GENERAL",
    questions:[
      "Qual provider foi mais utilizado?",
      "Quanto cada provider consumiu em tokens?",
      "Quanto cada provider gerou de custo?"
    ],
    sortOrder:20
  },
  {
    key:"general_model_consumption",
    name:"Consumo por Modelo",
    description:"Distribui\u00e7\u00e3o de consumo agrupada por modelo.",
    category:"GENERAL",
    questions:[
      "Quais modelos foram mais utilizados?",
      "Qual modelo consumiu mais tokens?",
      "Qual modelo teve maior custo?"
    ],
    sortOrder:30
  },
  {
    key:"general_recent_requests",
    name:"\u00daltimas requisi\u00e7\u00f5es",
    description:"Vis\u00e3o das requisi\u00e7\u00f5es mais recentes registradas.",
    category:"GENERAL",
    questions:[
      "Quais foram as \u00faltimas requisi\u00e7\u00f5es?",
      "Quais providers e modelos foram usados recentemente?",
      "Houve falhas nas requisi\u00e7\u00f5es recentes?"
    ],
    sortOrder:40
  },
  {
    key:"finance_month_spend",
    name:"Gasto do m\u00eas",
    description:"Custo estimado acumulado no m\u00eas atual.",
    category:"FINANCE",
    questions:[
      "Quanto foi gasto este m\u00eas?",
      "Como o gasto se distribui por provider?",
      "Como o gasto se distribui por modelo?"
    ],
    sortOrder:10
  },
  {
    key:"finance_top_cost_provider",
    name:"Provider com maior custo",
    description:"Provider que mais gerou custo no per\u00edodo.",
    category:"FINANCE",
    questions:[
      "Qual provider gerou maior custo?",
      "Qual foi a participa\u00e7\u00e3o desse provider no custo total?",
      "Esse provider tamb\u00e9m foi o mais utilizado?"
    ],
    sortOrder:20
  },
  {
    key:"finance_daily_costs",
    name:"Evolu\u00e7\u00e3o di\u00e1ria dos custos",
    description:"S\u00e9rie di\u00e1ria de custos estimados.",
    category:"FINANCE",
    questions:[
      "Como os custos evolu\u00edram por dia?",
      "Qual dia teve maior custo?",
      "Houve aumento relevante de custo no per\u00edodo?"
    ],
    sortOrder:30
  },
  {
    key:"finance_billing_group_consumption",
    name:"Billing Group que mais consumiu",
    description:"Ranking de consumo e custo por Billing Group.",
    category:"FINANCE",
    questions:[
      "Qual Billing Group mais consumiu?",
      "Qual Billing Group gerou maior custo?",
      "Como o consumo se distribui entre Billing Groups?"
    ],
    sortOrder:40
  },
  {
    key:"operations_request_count",
    name:"Quantidade de requisi\u00e7\u00f5es",
    description:"Volume de requisi\u00e7\u00f5es no per\u00edodo.",
    category:"OPERATIONS",
    questions:[
      "Quantas requisi\u00e7\u00f5es foram feitas?",
      "Como o volume se distribui por provider?",
      "Como o volume se distribui por modelo?"
    ],
    sortOrder:10
  },
  {
    key:"operations_success_rate",
    name:"Taxa de sucesso",
    description:"Percentual de requisi\u00e7\u00f5es bem-sucedidas.",
    category:"OPERATIONS",
    questions:[
      "Qual foi a taxa de sucesso?",
      "Quantas requisi\u00e7\u00f5es falharam?",
      "Quais providers tiveram menor taxa de sucesso?"
    ],
    sortOrder:20
  },
  {
    key:"operations_average_latency",
    name:"Lat\u00eancia m\u00e9dia",
    description:"Tempo m\u00e9dio das requisi\u00e7\u00f5es.",
    category:"OPERATIONS",
    questions:[
      "Qual foi a lat\u00eancia m\u00e9dia?",
      "Qual provider teve maior lat\u00eancia?",
      "Qual modelo teve maior lat\u00eancia?"
    ],
    sortOrder:30
  },
  {
    key:"operations_active_groups",
    name:"Billing Groups mais ativos",
    description:"Billing Groups com maior volume de requisi\u00e7\u00f5es.",
    category:"OPERATIONS",
    questions:[
      "Quais Billing Groups foram mais ativos?",
      "Quantas requisi\u00e7\u00f5es cada Billing Group realizou?",
      "Quais Billing Groups tiveram mais erros?"
    ],
    sortOrder:40
  },
  {
    key:"support_frequent_errors",
    name:"Erros mais frequentes",
    description:"Tipos e ocorr\u00eancias de falhas mais comuns.",
    category:"SUPPORT",
    questions:[
      "Quais foram os erros mais frequentes?",
      "Quantas vezes cada erro ocorreu?",
      "Quais providers tiveram mais erros?"
    ],
    sortOrder:10
  },
  {
    key:"support_recent_errors",
    name:"\u00daltimos erros registrados",
    description:"Falhas registradas mais recentemente.",
    category:"SUPPORT",
    questions:[
      "Quais foram os \u00faltimos erros registrados?",
      "Em quais projetos ocorreram os \u00faltimos erros?",
      "Quais providers aparecem nos erros recentes?"
    ],
    sortOrder:20
  },
  {
    key:"support_failure_history",
    name:"Hist\u00f3rico de falhas",
    description:"Evolu\u00e7\u00e3o das falhas ao longo do tempo.",
    category:"SUPPORT",
    questions:[
      "Como as falhas evolu\u00edram no per\u00edodo?",
      "Qual dia teve mais falhas?",
      "As falhas aumentaram ou diminu\u00edram?"
    ],
    sortOrder:30
  },
  {
    key:"support_failed_projects",
    name:"Projetos com mais falhas",
    description:"Ranking de projetos com maior volume de erros.",
    category:"SUPPORT",
    questions:[
      "Quais projetos tiveram mais falhas?",
      "Quantas falhas cada projeto teve?",
      "Quais providers falharam nesses projetos?"
    ],
    sortOrder:40
  },
  {
    key:"sales_top_tenants",
    name:"Tenants com maior consumo",
    description:"Clientes com maior volume de consumo.",
    category:"SALES",
    questions:[
      "Quais tenants tiveram maior consumo?",
      "Quais tenants geraram maior custo?",
      "Como o consumo evoluiu por tenant?"
    ],
    sortOrder:10
  },
  {
    key:"sales_growth",
    name:"Crescimento de consumo",
    description:"Evolu\u00e7\u00e3o do consumo ao longo do tempo.",
    category:"SALES",
    questions:[
      "O consumo cresceu no per\u00edodo?",
      "Qual foi a varia\u00e7\u00e3o de consumo?",
      "Quais projetos puxaram o crescimento?"
    ],
    sortOrder:20
  },
  {
    key:"sales_external_users",
    name:"Consumo por usu\u00e1rio externo",
    description:"Consumo agrupado por externalUserId.",
    category:"SALES",
    questions:[
      "Quais usu\u00e1rios externos mais consumiram?",
      "Qual foi o custo por usu\u00e1rio externo?",
      "Quais modelos cada usu\u00e1rio externo utilizou?"
    ],
    sortOrder:30
  }
];



interface CreateTopicBody {

  name:string;

  description?:string;

  category?:string;

  assistantId?:string;

  questions?:any;

  enabled?:boolean;

  sortOrder?:number;

}

interface AddDefaultTopicsBody {

  assistantId:string;

  topicKeys:string[];

}

export interface ExecuteTopicBody {
  startDate?: string;
  endDate?: string;
  assistantId?: string;
  apiKeyId?: string;
  model?: string;
  provider?: string;
}



class TopicService {


  listDefaultTopics(
    category?:string
  ){

    if(!category){

      return defaultTopics;

    }



    return defaultTopics.filter(
      topic =>
        topic.category === category
    );

  }

  async addDefaultTopics(
    user:AuthenticatedUser,
    data:AddDefaultTopicsBody
  ){

    if(!data.assistantId){

      throw new Error(
        "Assistant \u00e9 obrigat\u00f3rio."
      );

    }



    if(!Array.isArray(data.topicKeys) || !data.topicKeys.length){

      throw new Error(
        "Selecione ao menos um t\u00f3pico padr\u00e3o."
      );

    }



    const assistant =
      await prisma.assistant.findFirst({

        where:{

          id:data.assistantId,

          tenantId:user.tenantId

        }

      });



    if(!assistant){

      throw new Error(
        "Assistant n\u00e3o encontrado."
      );

    }



    const selectedTopics =
      defaultTopics.filter(
        topic =>
          data.topicKeys.includes(topic.key)
      );



    if(selectedTopics.length !== data.topicKeys.length){

      throw new Error(
        "Um ou mais t\u00f3picos padr\u00e3o s\u00e3o inv\u00e1lidos."
      );

    }



    const existingTopics =
      await prisma.topic.findMany({

        where:{

          tenantId:user.tenantId,

          assistantId:data.assistantId,

          OR:selectedTopics.map(topic => ({

            name:topic.name,

            category:topic.category

          }))

        },

        select:{

          name:true,

          category:true

        }

      });



    const existingKeys =
      new Set(
        existingTopics.map(
          topic =>
            `${topic.category}:${topic.name}`
        )
      );



    const topicsToCreate =
      selectedTopics.filter(
        topic =>
          !existingKeys.has(`${topic.category}:${topic.name}`)
      );



    if(topicsToCreate.length){

      await prisma.topic.createMany({

        data:topicsToCreate.map(topic => ({

          tenantId:user.tenantId,

          assistantId:data.assistantId,

          name:topic.name,

          description:topic.description,

          category:topic.category,

          questions:[...topic.questions],

          enabled:true,

          sortOrder:topic.sortOrder

        }))

      });

    }



    const topics =
      await prisma.topic.findMany({

        where:{

          tenantId:user.tenantId,

          assistantId:data.assistantId,

          OR:selectedTopics.map(topic => ({

            name:topic.name,

            category:topic.category

          }))

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



    return {

      created:topicsToCreate.length,

      skipped:selectedTopics.length - topicsToCreate.length,

      data:topics

    };

  }


  async create(
    user:AuthenticatedUser,
    data:CreateTopicBody
  ){


    if(!data.name.trim()){

      throw new Error(
        "Nome do tópico é obrigatório."
      );

    }



    if(data.assistantId){


      const assistant =
        await prisma.assistant.findFirst({

          where:{

            id:data.assistantId,

            tenantId:user.tenantId

          }

        });



      if(!assistant){

        throw new Error(
          "Assistant não encontrado."
        );

      }

    }



    const topic =
      await prisma.topic.create({

        data:{

          tenantId:user.tenantId,

          name:data.name,

          description:data.description,

          category:data.category,

          assistantId:data.assistantId,

          questions:data.questions,

          enabled:
            data.enabled ?? true,

          sortOrder:
            data.sortOrder ?? 0

        }

      });



    return topic;


  }

  async list(
    user:AuthenticatedUser
  ){

    const topics =
      await prisma.topic.findMany({

        where:{

          tenantId:user.tenantId

        },

        include:{

          assistant:{

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



    return topics;

  }

  async listByAssistant(
    user: AuthenticatedUser,
    assistantId: string
  ) {
    const topics = await prisma.topic.findMany({
      where: {
        tenantId: user.tenantId,
        assistantId,
      },
      include: {
        assistant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    return topics;
  }

  async getById(
    user:AuthenticatedUser,
    id:string
  ){

    const topic =
      await prisma.topic.findFirst({

        where:{

          id,

          tenantId:user.tenantId

        },

        include:{

          assistant:{

            select:{

              id:true,

              name:true

            }

          }

        }

      });



    if(!topic){

      throw new Error(
        "T\u00f3pico n\u00e3o encontrado."
      );

    }



    return topic;

  }

  async update(
    user:AuthenticatedUser,
    id:string,
    data:Partial<CreateTopicBody>
  ){

    const existing =
      await prisma.topic.findFirst({

        where:{

          id,

          tenantId:user.tenantId

        }

      });



    if(!existing){

      throw new Error(
        "T\u00f3pico n\u00e3o encontrado."
      );

    }



    if(data.name !== undefined && !data.name.trim()){

      throw new Error(
        "Nome do t\u00f3pico \u00e9 obrigat\u00f3rio."
      );

    }



    if(data.assistantId){

      const assistant =
        await prisma.assistant.findFirst({

          where:{

            id:data.assistantId,

            tenantId:user.tenantId

          }

        });



      if(!assistant){

        throw new Error(
          "Assistant n\u00e3o encontrado."
        );

      }

    }



    const topic =
      await prisma.topic.update({

        where:{

          id

        },

        data:{

          ...data

        }

      });



    return topic;

  }

  async delete(
    user:AuthenticatedUser,
    id:string
  ){

    const existing =
      await prisma.topic.findFirst({

        where:{

          id,

          tenantId:user.tenantId

        }

      });



    if(!existing){

      throw new Error(
        "T\u00f3pico n\u00e3o encontrado."
      );

    }



    const topic =
      await prisma.topic.delete({

        where:{

          id

        }

      });



    return topic;

  }

  async execute(
    user:AuthenticatedUser,
    id:string,
    data:ExecuteTopicBody = {}
  ){
    let topic: any = null;

    try {
      topic = await prisma.topic.findFirst({
        where:{
          id,
          tenantId:user.tenantId,
          enabled:true
        },
        include:{
          assistant:{
            include:{
              apiKey:{
                include:{
                  providerCredential:true
                }
              }
            }
          }
        }
      });
    } catch {
      // ignore
    }

    if(!topic){
      const def = defaultTopics.find(t => t.key === id || t.name === id || `topic-${t.key}` === id);
      if (def) {
        topic = {
          id: def.key,
          tenantId: user.tenantId,
          name: def.name,
          description: def.description,
          category: def.category,
          questions: def.questions,
          enabled: true,
          assistant: null
        };
      }
    }

    if(!topic){
      throw new Error(
        "Tópico não encontrado."
      );
    }

    // 1. Resolve o Assistente de Execução (com suporte a override de teste)
    let executionAssistant = topic.assistant;

    if (data.assistantId && data.assistantId !== topic.assistantId) {
      const customAssistant = await prisma.assistant.findFirst({
        where: { id: data.assistantId, tenantId: user.tenantId, enabled: true },
        include: {
          apiKey: {
            include: { providerCredential: true }
          }
        }
      });
      if (customAssistant) {
        executionAssistant = customAssistant;
      }
    }

    if (data.apiKeyId) {
      const customApiKey = await prisma.apiKey.findFirst({
        where: { id: data.apiKeyId, tenantId: user.tenantId, isActive: true },
        include: { providerCredential: true }
      });
      if (customApiKey) {
        executionAssistant = {
          ...(executionAssistant || {
            id: 'custom-test-assistant',
            name: `Analista de Teste (${customApiKey.provider})`,
            type: topic.category || 'GENERAL',
            temperature: 0.2,
            maxTokens: 4096,
            systemPrompt: 'Você é um assistente especialista encarregado de analisar métricas e dados de consumo de IA.'
          }),
          apiKeyId: customApiKey.id,
          apiKey: customApiKey,
          provider: customApiKey.provider,
        };
      }
    }

    if (data.model && data.model.trim()) {
      if (executionAssistant) {
        executionAssistant = {
          ...executionAssistant,
          model: data.model.trim()
        };
      }
    }

    if (executionAssistant && !executionAssistant.enabled) {
      throw new Error("Assistant desativado.");
    }

    if (executionAssistant?.apiKey && !executionAssistant.apiKey.isActive) {
      throw new Error("API Key do Assistant está inativa.");
    }

    const period =
      this.buildPeriod(data);

    const where =
      await scopeService.buildWhere(
        user,
        period.startDate,
        period.endDate
      );

    const context =
      await this.buildTopicContext(
        user,
        topic.category,
        where,
        period.startDate,
        period.endDate
      );

    let answer: TopicAnswer | null = null;

    if (executionAssistant) {
      try {
        answer = await this.callAssistant(
          user,
          topic,
          executionAssistant,
          this.normalizeQuestions(topic.questions),
          context
        );
      } catch (err: any) {
        console.error('[TopicService] Falha ao invocar LLM para o tópico:', err?.message || err);
      }
    }

    if (!answer || !answer.content || (answer.statusCode && answer.statusCode >= 400)) {
      const summary = (context as any)?.summary || {};
      const totalReqs = Number(summary.requests ?? summary.totalRequests ?? 0).toLocaleString('pt-BR');

      const rawCost = typeof summary.costs?.total === 'number'
        ? summary.costs.total
        : (typeof summary.cost === 'number' ? summary.cost : (summary.totalCost ?? 0));
      const totalCost = Number(rawCost).toFixed(4);

      const rawTokens = typeof summary.tokens?.total === 'number'
        ? summary.tokens.total
        : (typeof summary.tokens === 'number' ? summary.tokens : (summary.totalTokens ?? 0));
      const totalTokensFormatted = Number(rawTokens).toLocaleString('pt-BR');

      const inputTokens = typeof summary.tokens?.input === 'number' ? Number(summary.tokens.input).toLocaleString('pt-BR') : null;
      const outputTokens = typeof summary.tokens?.output === 'number' ? Number(summary.tokens.output).toLocaleString('pt-BR') : null;

      const rawLatency = summary.latency?.averageMs ?? summary.latency?.average ?? summary.averageLatencyMs ?? summary.latencyMs ?? 0;
      const avgLatency = Math.round(Number(rawLatency));

      const qList = (this.normalizeQuestions(topic.questions) || []).map((q: string) => `• ${q}`).join("\n");

      let tokenDetails = `• **Volume de Tokens:** ${totalTokensFormatted}`;
      if (inputTokens && outputTokens) {
        tokenDetails += ` (${inputTokens} entrada / ${outputTokens} saída)`;
      }

      answer = {
        statusCode: 200,
        provider: topic.assistant?.provider || 'sistema',
        model: topic.assistant?.model || 'analítica',
        content: `📊 **Análise do Tópico: ${topic.name}**\n\n` +
          `**Perguntas de Referência:**\n${qList || '• Análise geral de consumo'}\n\n` +
          `**Métricas Processadas do Período:**\n` +
          `• **Total de Requisições:** ${totalReqs}\n` +
          `• **Custo Total Estimado:** $ ${totalCost}\n` +
          `${tokenDetails}\n` +
          `• **Latência Média:** ${avgLatency}ms\n\n` +
          (topic.assistant && answer && answer.statusCode && answer.statusCode >= 400
            ? `⚠️ *Nota: O modelo do analista ("${topic.assistant.model || 'não configurado'}") retornou status ${answer.statusCode} na API externa. Exibindo métricas compiladas do período.*`
            : `💡 *Dica: Associe um Assistente e credenciais ativas ao tópico para respostas textuais geradas via IA.*`)
      };
    }

    return {
      topic:{
        id:topic.id,
        name:topic.name,
        description:topic.description,
        category:topic.category,
        questions:
          this.normalizeQuestions(topic.questions)
      },
      assistant:topic.assistant ? {
        id:topic.assistant.id,
        name:topic.assistant.name,
        type:topic.assistant.type,
        provider:topic.assistant.provider,
        model:topic.assistant.model,
        apiKey:topic.assistant.apiKey ? {
          id:topic.assistant.apiKey.id,
          name:topic.assistant.apiKey.name,
          provider:topic.assistant.apiKey.provider
        } : null
      } : null,
      period,
      context,
      answer
    };
  }

  private buildPeriod(
    data:ExecuteTopicBody
  ){
    const endDate = parseBrasiliaEndDate(data.endDate);
    const startDate = data.startDate
      ? parseBrasiliaStartDate(data.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if(
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ){
      throw new Error(
        "Período inválido."
      );
    }

    return {
      startDate,
      endDate
    };
  }

  private async callAssistant(
    user: AuthenticatedUser,
    topic: any,
    assistant: any,
    questions: string[],
    context: any
  ) {
    const apiKey = assistant.apiKey;
    const credential = apiKey?.providerCredential;

    if (!apiKey || !credential) {
      return null;
    }

    if (!credential.isActive) {
      throw new Error("Provider Credential do Assistant está inativa.");
    }

    if (!isSupportedProvider(credential.provider)) {
      throw new Error("Provider do Assistant não suportado.");
    }

    const contextText = JSON.stringify(context, null, 2);

    const userPrompt = [
      `Tópico: ${topic.name || 'Análise de Telemetria'}`,
      "",
      "Perguntas selecionadas:",
      ...questions.map(question => `- ${question}`),
      "",
      "Contexto consultado no banco:",
      contextText,
      "",
      "Responda em português do Brasil, de forma objetiva, usando somente os dados do contexto. Se algum dado não estiver disponível, informe isso claramente."
    ].join("\n");

    const modelToUse = assistant.model?.trim()
      ? assistant.model.trim()
      : (credential.provider === 'anthropic' ? 'claude-3-5-sonnet-20241022'
        : credential.provider === 'google' ? 'gemini-1.5-flash'
        : credential.provider === 'groq' ? 'llama-3.3-70b-versatile'
        : credential.provider === 'mistral' ? 'mistral-large-latest'
        : 'gpt-4o-mini');

    const result = await callProvider({
      provider: credential.provider,
      apiKey: credential.apiKey,
      model: modelToUse,
      baseUrl: credential.baseUrl ?? undefined,
      body: {
        messages: [
          ...(assistant.systemPrompt?.trim()
            ? [{ role: "system", content: assistant.systemPrompt.trim() }]
            : []),
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: assistant.temperature,
        max_tokens: assistant.maxTokens
      }
    });

    const billingGroupMap: Record<string, string> = {
      FINANCE: 'Financeiro',
      OPERATIONS: 'Operações',
      SUPPORT: 'Suporte',
      SALES: 'Vendas',
      GENERAL: 'Geral',
      CUSTOM: 'Personalizado',
    };
    const billingGroupName = billingGroupMap[assistant.type || topic.category || ''] || assistant.type || topic.category || 'Quopiloto';

    try {
      await addUsageJob({
        tenantId: user.tenantId,
        apiKeyId: assistant.apiKeyId ?? null,
        provider: credential.provider,
        model: modelToUse,
        statusCode: result.statusCode ?? 200,
        latencyMs: result.latencyMs ?? 0,
        promptTokens: result.promptTokens ?? 0,
        completionTokens: result.completionTokens ?? 0,
        totalTokens: result.totalTokens ?? ((result.promptTokens ?? 0) + (result.completionTokens ?? 0)),
        cachedTokens: result.cachedTokens ?? 0,
        reasoningTokens: result.reasoningTokens ?? 0,
        project: 'quopilot',
        agent: assistant.name || 'Quopiloto',
        billingGroup: billingGroupName,
        tags: ['quopilot', 'copilot-test', 'analise-topico'],
        environment: 'production',
        externalUserId: user.id || 'widget-user',
        requestGroup: 'quopilot-analysis',
        traceId: `qta_quopilot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
    } catch (queueErr) {
      console.error('[TopicService] Erro ao enfileirar métrica de uso do Quopiloto:', queueErr);
    }

    return {
      provider: credential.provider,
      model: modelToUse,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      content: this.extractProviderText(result.body),
      raw: result.body
    };
  }

  private extractProviderText(
    body:any
  ){

    return (
      body?.choices?.[0]?.message?.content ??
      body?.choices?.[0]?.text ??
      body?.content?.[0]?.text ??
      body?.candidates?.[0]?.content?.parts?.[0]?.text ??
      null
    );

  }

  private normalizeQuestions(
    questions:Prisma.JsonValue
  ){

    if(Array.isArray(questions)){

      return questions.filter(
        (question): question is string =>
          typeof question === "string"
      );

    }



    return [];

  }

  private async buildTopicContext(
    user:AuthenticatedUser,
    category:string|null,
    where:Prisma.UsageLogWhereInput,
    startDate:Date,
    endDate:Date
  ){

    const summary =
      await DashboardService.getSummary(
        where,
        startDate,
        endDate
      );

    const [
      providers,
      models,
      projects,
      agents,
      billingGroups,
      users,
      dailyConsumption,
      latency,
      errors
    ] =
      await Promise.all([

        DashboardService.getProviders(where),

        DashboardService.getModels(where),

        DashboardService.getProjects(where),

        DashboardService.getAgents(where),

        DashboardService.getBillingGroups(where),

        DashboardService.getUsers(where),

        DashboardService.getDailyConsumption(where),

        DashboardService.getLatency(where),

        DashboardService.getErrors(where)

      ]);

    const baseContext = {

      summary,

      providers:this.takeTop(providers),

      models:this.takeTop(models),

      projects:this.takeTop(projects),

      agents:this.takeTop(agents),

      billingGroups:this.takeTop(billingGroups),

      users:this.takeTop(users),

      dailyConsumption,

      latency,

      errors

    };



    if(category === "SUPPORT"){

      return {

        ...baseContext,

        failedUsages:
          await this.getFailedUsageContext(
            user.tenantId,
            startDate,
            endDate
          )

      };

    }



    return baseContext;

  }

  private takeTop<T extends {
    requests?:number;
    tokens?:number;
    cost?:number;
  }>(
    items:T[],
    limit = 10
  ){

    return [...items]
      .sort((a, b) => {

        const aScore =
          Number(a.cost ?? a.tokens ?? a.requests ?? 0);

        const bScore =
          Number(b.cost ?? b.tokens ?? b.requests ?? 0);

        return bScore - aScore;

      })
      .slice(0, limit);

  }

  private async getFailedUsageContext(
    tenantId:string,
    startDate:Date,
    endDate:Date
  ){

    const where:Prisma.FailedUsageWhereInput = {

      tenantId,

      createdAt:{

        gte:startDate,

        lte:endDate

      }

    };

    const [
      total,
      recent,
      errors,
      providers,
      projects
    ] =
      await Promise.all([

        prisma.failedUsage.count({
          where
        }),

        prisma.failedUsage.findMany({

          where,

          orderBy:{
            createdAt:"desc"
          },

          take:10,

          select:{

            id:true,

            requestId:true,

            provider:true,

            model:true,

            project:true,

            agent:true,

            error:true,

            status:true,

            attempts:true,

            createdAt:true

          }

        }),

        prisma.failedUsage.groupBy({

          where,

          by:[
            "error"
          ],

          _count:{
            id:true
          },

          orderBy:{
            _count:{
              id:"desc"
            }
          },

          take:10

        }),

        prisma.failedUsage.groupBy({

          where,

          by:[
            "provider"
          ],

          _count:{
            id:true
          },

          orderBy:{
            _count:{
              id:"desc"
            }
          },

          take:10

        }),

        prisma.failedUsage.groupBy({

          where,

          by:[
            "project"
          ],

          _count:{
            id:true
          },

          orderBy:{
            _count:{
              id:"desc"
            }
          },

          take:10

        })

      ]);



    return {

      total,

      recent,

      errors:errors.map(item => ({

        error:item.error,

        count:item._count.id

      })),

      providers:providers.map(item => ({

        provider:item.provider ?? "Sem provider",

        count:item._count.id

      })),

      projects:projects.map(item => ({

        project:item.project ?? "Sem projeto",

        count:item._count.id

      }))

    };

  }


}


export default new TopicService();
