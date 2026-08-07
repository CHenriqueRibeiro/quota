export interface QuotaConfig {
  /** Chave de API da aplicação gerada no Quota */
  apiKey: string;
  
  /** URL do endpoint /collector do servidor Quota (Ex: http://localhost:3000/collector) */
  endpoint?: string;
  
  /** Nome do projeto para agrupamento de métricas */
  project?: string;
  
  /** Nome do agente associado às chamadas */
  agent?: string;
  
  /** Ambiente da aplicação (production, staging, development) */
  environment?: string;
  
  /** Habilitar logs de debug no console */
  debug?: boolean;
}

export interface QuotaMetadata {
  project?: string;
  agent?: string;
  environment?: string;
  externalUserId?: string;
  requestGroup?: string;
  tags?: string[];
}

export interface CollectorPayload {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  cacheCreationTokens?: number;
  latencyMs?: number;
  statusCode?: number;
  success?: boolean;
  metadata?: QuotaMetadata;
  traceId?: string;
  requestId?: string;
  billingGroup?: string;
}
