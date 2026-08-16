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
 * Identifica o provedor a partir do nome do modelo (inferência automática)
 */
export function inferProviderFromModel(modelName?: string): string {
  if (!modelName) return 'openai';
  const m = modelName.toLowerCase();
  if (m.includes('gpt') || m.includes('o1') || m.includes('o3') || m.includes('dall-e') || m.includes('text-embedding')) return 'openai';
  if (m.includes('claude') || m.includes('anthropic')) return 'anthropic';
  if (m.includes('gemini') || m.includes('palm') || m.includes('gemma')) return 'google';
  if (m.includes('mistral') || m.includes('mixtral') || m.includes('codestral') || m.includes('pixtral')) return 'mistral';
  if (m.includes('groq') || m.includes('llama') || m.includes('gemma-7b')) return 'groq';
  return 'openai';
}

/**
 * Extrai metadados customizados a partir dos cabeçalhos HTTP da requisição (ex: x-quota-agent, x-quota-user-id)
 */
export function extractMetadataFromHeaders(headers?: HeadersInit): QuotaMetadata {
  if (!headers) return {};

  const getHeader = (name: string): string | undefined => {
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
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
  headerMetadata?: QuotaMetadata
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

  // 1. OpenAI, Groq, Mistral, Together
  if (provider === 'openai' || provider === 'groq' || provider === 'together' || provider === 'mistral') {
    const usage = responseBodyJson?.usage;
    if (usage) {
      promptTokens = usage.prompt_tokens ?? 0;
      completionTokens = usage.completion_tokens ?? 0;
      totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);
      cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
      reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;
    }
  } 
  // 2. Anthropic (Claude)
  else if (provider === 'anthropic') {
    const usage = responseBodyJson?.usage;
    if (usage) {
      promptTokens = usage.input_tokens ?? 0;
      completionTokens = usage.output_tokens ?? 0;
      totalTokens = promptTokens + completionTokens;
      cachedTokens = usage.cache_read_input_tokens ?? 0;
      cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
    }
  } 
  // 3. Google Gemini
  else if (provider === 'google') {
    const usage = responseBodyJson?.usageMetadata;
    if (usage) {
      promptTokens = usage.promptTokenCount ?? 0;
      completionTokens = usage.candidatesTokenCount ?? 0;
      totalTokens = usage.totalTokenCount ?? (promptTokens + completionTokens);
      cachedTokens = usage.cachedContentTokenCount ?? 0;
      reasoningTokens = usage.thoughtsTokenCount ?? 0;
    }
  } 
  // Fallback genérico inteligente
  else {
    const usage = responseBodyJson?.usage || responseBodyJson?.usageMetadata;
    if (usage) {
      promptTokens = usage.prompt_tokens ?? usage.promptTokenCount ?? usage.input_tokens ?? usage.inputTokens ?? 0;
      completionTokens = usage.completion_tokens ?? usage.candidatesTokenCount ?? usage.output_tokens ?? usage.outputTokens ?? 0;
      totalTokens = usage.total_tokens ?? usage.totalTokenCount ?? (promptTokens + completionTokens);
      cachedTokens = usage.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? usage.cache_read_input_tokens ?? usage.cachedContentTokenCount ?? 0;
      reasoningTokens = usage.reasoning_tokens ?? usage.completion_tokens_details?.reasoning_tokens ?? usage.thoughtsTokenCount ?? 0;
    }
  }

  const bodyMetadata = requestBodyJson?.metadata || {};
  const mergedMetadata: QuotaMetadata = {
    project: headerMetadata?.project || bodyMetadata.project || requestBodyJson?.project || defaultMetadata?.project,
    agent: headerMetadata?.agent || bodyMetadata.agent || requestBodyJson?.agent || defaultMetadata?.agent,
    environment: headerMetadata?.environment || bodyMetadata.environment || defaultMetadata?.environment,
    externalUserId: headerMetadata?.externalUserId || bodyMetadata.externalUserId,
    requestGroup: headerMetadata?.requestGroup || bodyMetadata.requestGroup,
    billingGroup: headerMetadata?.billingGroup || requestBodyJson?.billingGroup,
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
    billingGroup: mergedMetadata.billingGroup,
    metadata: mergedMetadata
  };
}

/**
 * Extrai contagem de tokens de qualquer resposta de LLM (OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral)
 * ou estruturas de ferramentas MCP (tools/call, sampling, createMessage)
 */
export function extractMcpTokens(responseData: any): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  model?: string;
} {
  if (!responseData) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, reasoningTokens: 0 };
  }

  const usage =
    responseData?.usage ||
    responseData?._meta?.usage ||
    responseData?.meta?.usage ||
    responseData?.usageMetadata ||
    responseData?._meta?.usageMetadata ||
    {};

  // 1. Prompt / Input tokens
  const promptTokens =
    usage.prompt_tokens ??
    usage.promptTokens ??
    usage.input_tokens ??
    usage.inputTokens ??
    usage.promptTokenCount ??
    0;

  // 2. Completion / Output tokens
  const completionTokens =
    usage.completion_tokens ??
    usage.completionTokens ??
    usage.output_tokens ??
    usage.outputTokens ??
    usage.candidatesTokenCount ??
    0;

  // 3. Cached tokens (OpenAI cached_tokens, Anthropic cache_read, Gemini cachedContent)
  const cachedTokens =
    usage.cached_tokens ??
    usage.cachedTokens ??
    usage.prompt_tokens_details?.cached_tokens ??
    usage.cache_read_input_tokens ??
    usage.cachedContentTokenCount ??
    0;

  // 4. Reasoning / Thoughts tokens (OpenAI o1/o3 reasoning_tokens, Gemini 2.0 Flash thoughtsTokenCount)
  const reasoningTokens =
    usage.reasoning_tokens ??
    usage.reasoningTokens ??
    usage.completion_tokens_details?.reasoning_tokens ??
    usage.thoughtsTokenCount ??
    0;

  // 5. Total tokens
  const totalTokens =
    usage.total_tokens ??
    usage.totalTokens ??
    usage.totalTokenCount ??
    (promptTokens + completionTokens);

  const model = responseData?.model || responseData?._meta?.model || undefined;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    reasoningTokens,
    model
  };
}
