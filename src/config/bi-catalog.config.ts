export type DataType = 'string' | 'number' | 'boolean' | 'datetime';

export type AggregationFunction = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';

export type FilterOperator = 
  | 'EQUALS' 
  | 'NOT_EQUALS' 
  | 'IN' 
  | 'NOT_IN' 
  | 'GREATER_THAN' 
  | 'GREATER_THAN_OR_EQUAL' 
  | 'LESS_THAN' 
  | 'LESS_THAN_OR_EQUAL' 
  | 'CONTAINS';

export interface CatalogDimension {
  key: string;
  label: string;
  dataType: DataType;
  description: string;
  allowGroupBy: boolean;
  allowFilter: boolean;
  dbField: string;
  isJsonTag?: boolean;
}

export interface CatalogMetric {
  key: string;
  label: string;
  dataType: DataType;
  description: string;
  allowedAggregations: AggregationFunction[];
  dbField: string;
}

export interface TimeGranularityOption {
  key: string;
  label: string;
  sqlTrunc: string;
}

export const BI_DIMENSIONS: Record<string, CatalogDimension> = {
  date: {
    key: 'date',
    label: 'Data / Mês',
    dataType: 'datetime',
    description: 'Data de criação da requisição',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'createdAt',
  },
  createdAt: {
    key: 'createdAt',
    label: 'Data de Criação',
    dataType: 'datetime',
    description: 'Data e hora da requisição',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'createdAt',
  },
  provider: {
    key: 'provider',
    label: 'Provedor LLM',
    dataType: 'string',
    description: 'Provedor da API (openai, anthropic, google, etc.)',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'provider',
  },
  model: {
    key: 'model',
    label: 'Modelo LLM',
    dataType: 'string',
    description: 'Modelo de IA utilizado (ex: gpt-4o, claude-3-5-sonnet)',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'model',
  },
  project: {
    key: 'project',
    label: 'Projeto',
    dataType: 'string',
    description: 'Nome do projeto vinculado à requisição',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'project',
  },
  agent: {
    key: 'agent',
    label: 'Agente',
    dataType: 'string',
    description: 'Nome do agente virtual ou assistente',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'agent',
  },
  environment: {
    key: 'environment',
    label: 'Ambiente',
    dataType: 'string',
    description: 'Ambiente de execução (production, staging, dev)',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'environment',
  },
  externalUserId: {
    key: 'externalUserId',
    label: 'ID Usuário Externo',
    dataType: 'string',
    description: 'ID do usuário final na sua aplicação',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'externalUserId',
  },
  requestGroup: {
    key: 'requestGroup',
    label: 'Grupo de Requisição',
    dataType: 'string',
    description: 'Etiqueta de agrupamento de chamadas',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'requestGroup',
  },
  billingGroupId: {
    key: 'billingGroupId',
    label: 'ID Grupo Faturamento',
    dataType: 'string',
    description: 'ID do Billing Group associado',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'billingGroupId',
  },
  apiKeyId: {
    key: 'apiKeyId',
    label: 'ID Chave API',
    dataType: 'string',
    description: 'ID da chave de API utilizada',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'apiKeyId',
  },
  traceId: {
    key: 'traceId',
    label: 'Trace ID',
    dataType: 'string',
    description: 'Identificador único do trace (alta cardinalidade)',
    allowGroupBy: false,
    allowFilter: true,
    dbField: 'traceId',
  },
  statusCode: {
    key: 'statusCode',
    label: 'Status Code HTTP',
    dataType: 'number',
    description: 'Código de status HTTP da resposta (ex: 200, 429, 500)',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'statusCode',
  },
  success: {
    key: 'success',
    label: 'Sucesso',
    dataType: 'boolean',
    description: 'Indica se a requisição foi concluída com sucesso',
    allowGroupBy: true,
    allowFilter: true,
    dbField: 'success',
  },
};

export const BI_METRICS: Record<string, CatalogMetric> = {
  requestCount: {
    key: 'requestCount',
    label: 'Quantidade de Requisições',
    dataType: 'number',
    description: 'Contagem total de requisições executadas',
    allowedAggregations: ['COUNT'],
    dbField: 'id',
  },
  promptTokens: {
    key: 'promptTokens',
    label: 'Tokens de Entrada (Prompt)',
    dataType: 'number',
    description: 'Total de tokens de prompt processados',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'promptTokens',
  },
  completionTokens: {
    key: 'completionTokens',
    label: 'Tokens de Saída (Completion)',
    dataType: 'number',
    description: 'Total de tokens de resposta gerados',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'completionTokens',
  },
  totalTokens: {
    key: 'totalTokens',
    label: 'Tokens Totais',
    dataType: 'number',
    description: 'Soma de tokens de entrada e saída',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'totalTokens',
  },
  cachedTokens: {
    key: 'cachedTokens',
    label: 'Tokens em Cache',
    dataType: 'number',
    description: 'Tokens reaproveitados do cache de prompt',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'cachedTokens',
  },
  reasoningTokens: {
    key: 'reasoningTokens',
    label: 'Tokens de Raciocínio (CoT)',
    dataType: 'number',
    description: 'Tokens consumidos no raciocínio interno do modelo',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'reasoningTokens',
  },
  cacheCreationTokens: {
    key: 'cacheCreationTokens',
    label: 'Tokens de Criação de Cache',
    dataType: 'number',
    description: 'Tokens consumidos na criação/escrita do cache',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'cacheCreationTokens',
  },
  estimatedCost: {
    key: 'estimatedCost',
    label: 'Custo Estimado ($)',
    dataType: 'number',
    description: 'Valor financeiro estimado consumido em Dólares',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'estimatedCost',
  },
  latencyMs: {
    key: 'latencyMs',
    label: 'Latência (ms)',
    dataType: 'number',
    description: 'Tempo total de resposta da requisição em milissegundos',
    allowedAggregations: ['SUM', 'AVG', 'MIN', 'MAX'],
    dbField: 'latencyMs',
  },
};

export const BI_TIME_GRANULARITIES: Record<string, TimeGranularityOption> = {
  hour: { key: 'hour', label: 'Por Hora', sqlTrunc: 'hour' },
  day: { key: 'day', label: 'Por Dia', sqlTrunc: 'day' },
  week: { key: 'week', label: 'Por Semana', sqlTrunc: 'week' },
  month: { key: 'month', label: 'Por Mês', sqlTrunc: 'month' },
};

export const BI_CATALOG_EXPORT = {
  dimensions: Object.values(BI_DIMENSIONS),
  metrics: Object.values(BI_METRICS),
  timeGranularities: Object.values(BI_TIME_GRANULARITIES),
  allowedOperators: [
    'EQUALS',
    'NOT_EQUALS',
    'IN',
    'NOT_IN',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL',
    'CONTAINS',
  ] as FilterOperator[],
};
