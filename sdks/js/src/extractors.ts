import { CollectorPayload, QuotaMetadata } from './types';

/**
 * Identifica o provedor de IA com base na URL de destino da requisição
 */
export function detectProvider(url: string): string | null {
  const lowercaseUrl = url.toLowerCase();
  
  if (lowercaseUrl.includes('api.openai.com')) return 'openai';
  if (lowercaseUrl.includes('api.anthropic.com')) return 'anthropic';
  if (lowercaseUrl.includes('generativelanguage.googleapis.com')) return 'google';
  if (lowercaseUrl.includes('api.groq.com')) return 'groq';
  if (lowercaseUrl.includes('api.mistral.ai')) return 'mistral';
  if (lowercaseUrl.includes('api.together.xyz')) return 'together';
  if (lowercaseUrl.includes('api.cohere.com')) return 'cohere';
  
  return null;
}

/**
 * Extrai metadados customizados a partir dos cabeçalhos HTTP da requisição (ex: x-quota-agent, x-quota-user-id)
 */
export function extractMetadataFromHeaders(headers?: HeadersInit): QuotaMetadata & { billingGroup?: string } {
  if (!headers) return {};

  const getHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    } else if (Array.isArray(headers)) {
      const match = headers.find(([k]) => k.toLowerCase() === name.toLowerCase());
      return match ? match[1] : undefined;
    } else if (typeof headers === 'object') {
      const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
      return key ? (headers as Record<string, string>)[key] : undefined;
    }
    return undefined;
  };

  const project = getHeader('x-quota-project');
  const agent = getHeader('x-quota-agent');
  const environment = getHeader('x-quota-environment');
  const externalUserId = getHeader('x-quota-user-id');
  const requestGroup = getHeader('x-quota-request-group');
  const billingGroup = getHeader('x-quota-billing-group');
  const tagsStr = getHeader('x-quota-tags');

  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : undefined;

  return {
    project,
    agent,
    environment,
    externalUserId,
    requestGroup,
    billingGroup,
    tags
  };
}

/**
 * Extrai os dados de telemetria a partir do payload da resposta e da requisição
 */
export function extractTelemetry(
  provider: string,
  requestBodyJson: any,
  responseBodyJson: any,
  latencyMs: number,
  statusCode: number,
  defaultMetadata?: QuotaMetadata,
  headerMetadata?: QuotaMetadata & { billingGroup?: string }
): CollectorPayload {
  const model =
    responseBodyJson?.model ||
    requestBodyJson?.model ||
    'unknown';

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let cachedTokens = 0;
  let reasoningTokens = 0;
  let cacheCreationTokens = 0;

  if (provider === 'openai' || provider === 'groq' || provider === 'together' || provider === 'mistral') {
    const usage = responseBodyJson?.usage;
    if (usage) {
      promptTokens = usage.prompt_tokens ?? 0;
      completionTokens = usage.completion_tokens ?? 0;
      totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);
      cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
      reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;
    }
  } else if (provider === 'anthropic') {
    const usage = responseBodyJson?.usage;
    if (usage) {
      promptTokens = usage.input_tokens ?? 0;
      completionTokens = usage.output_tokens ?? 0;
      totalTokens = promptTokens + completionTokens;
      cachedTokens = usage.cache_read_input_tokens ?? 0;
      cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
    }
  } else if (provider === 'google') {
    const usage = responseBodyJson?.usageMetadata;
    if (usage) {
      promptTokens = usage.promptTokenCount ?? 0;
      completionTokens = usage.candidatesTokenCount ?? 0;
      totalTokens = usage.totalTokenCount ?? (promptTokens + completionTokens);
      cachedTokens = usage.cachedContentTokenCount ?? 0;
    }
  } else {
    // Tenta fallback genérico
    const usage = responseBodyJson?.usage || responseBodyJson?.usageMetadata;
    if (usage) {
      promptTokens = usage.prompt_tokens ?? usage.promptTokenCount ?? usage.input_tokens ?? 0;
      completionTokens = usage.completion_tokens ?? usage.candidatesTokenCount ?? usage.output_tokens ?? 0;
      totalTokens = usage.total_tokens ?? usage.totalTokenCount ?? (promptTokens + completionTokens);
    }
  }

  // Mescla metadados padrão do SDK com os metadados específicos da requisição (headers ou body)
  const bodyMetadata = requestBodyJson?.metadata || {};
  const mergedMetadata: QuotaMetadata = {
    project: headerMetadata?.project || bodyMetadata.project || requestBodyJson?.project || defaultMetadata?.project,
    agent: headerMetadata?.agent || bodyMetadata.agent || requestBodyJson?.agent || defaultMetadata?.agent,
    environment: headerMetadata?.environment || bodyMetadata.environment || defaultMetadata?.environment,
    externalUserId: headerMetadata?.externalUserId || bodyMetadata.externalUserId,
    requestGroup: headerMetadata?.requestGroup || bodyMetadata.requestGroup,
    tags: headerMetadata?.tags || bodyMetadata.tags || defaultMetadata?.tags
  };

  return {
    provider,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    reasoningTokens,
    cacheCreationTokens,
    latencyMs,
    statusCode,
    success: statusCode >= 200 && statusCode < 300,
    billingGroup: headerMetadata?.billingGroup || requestBodyJson?.billingGroup,
    metadata: mergedMetadata
  };
}

