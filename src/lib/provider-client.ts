import type { SupportedProvider } from './providers';
import llmPricingService from '../service/llm-pricing.service';

export interface ProviderCallOptions {
  provider: SupportedProvider;
  apiKey: string;
  model: string;
  body: any;
  baseUrl?: string;
  endpoint?: string;
}

export interface ProviderCallResult {
  statusCode: number;
  body: any;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
}

export const PROVIDER_BASE_ORIGINS: Record<SupportedProvider, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  groq: 'https://api.groq.com/openai',
  mistral: 'https://api.mistral.ai',
};

export const DEFAULT_PROVIDER_URLS: Record<SupportedProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google:
    'https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
};

export function normalizeModelForProvider(
  provider: SupportedProvider,
  model: string
): string {
  if (!model || !model.trim()) return model;
  let clean = model.trim();

  // Remove vendor prefixes como "openai/", "anthropic/", "google/", "groq/", "mistralai/", "mistral/"
  const prefixes = [
    'openai/',
    'anthropic/',
    'google/',
    'groq/',
    'mistralai/',
    'mistral/',
    'deepseek/',
    'meta-llama/',
    'qwen/',
  ];

  for (const p of prefixes) {
    if (clean.toLowerCase().startsWith(p)) {
      clean = clean.slice(p.length);
      break;
    }
  }

  // Remove sufixos operacionais como :batch, :free, :nitro, :fast, -fast, -nitro, -batch
  clean = clean.replace(/:(batch|free|online|nitro|fast)$/i, '').replace(/-(fast|nitro|free|online|batch)$/i, '');

  const low = clean.toLowerCase();

  // 1. ANTHROPIC CLAUDE MAPPING (Dinâmico e à prova de novos lançamentos)
  if (provider === 'anthropic') {
    // Converte pontos em números de versão para hífens (ex: claude-opus-4.8 -> claude-opus-4-8, claude-sonnet-5.5 -> claude-sonnet-5-5)
    const m = clean.split('.').join('-');
    const anthropicLow = m.toLowerCase();

    // Se já começa com "claude-", é um modelo nominal oficial
    if (anthropicLow.startsWith('claude-')) {
      // Snapshots com data obrigatória na Anthropic
      if (anthropicLow.includes('3-7-sonnet') || anthropicLow.includes('3.7-sonnet') || anthropicLow.includes('3.7 sonnet')) {
        return 'claude-3-7-sonnet-20250219';
      }
      if (anthropicLow.includes('3-5-sonnet') || anthropicLow.includes('3.5-sonnet') || anthropicLow.includes('3.5 sonnet')) {
        return 'claude-3-5-sonnet-20241022';
      }
      if (anthropicLow.includes('3-5-haiku') || anthropicLow.includes('3.5-haiku') || anthropicLow.includes('3.5 haiku')) {
        return 'claude-3-5-haiku-20241022';
      }
      if (anthropicLow.includes('3-opus') || anthropicLow.includes('3.0-opus') || anthropicLow.includes('3 opus')) {
        return 'claude-3-opus-20240229';
      }
      if (anthropicLow.includes('3-haiku') || anthropicLow.includes('3 haiku')) {
        return 'claude-3-haiku-20240307';
      }
      if (anthropicLow.includes('opus-4-5')) return 'claude-opus-4-5-20251101';
      if (anthropicLow.includes('haiku-4-5')) return 'claude-haiku-4-5-20251001';
      if (anthropicLow.includes('sonnet-4-5')) return 'claude-sonnet-4-5-20250929';

      // Novos modelos futuros (ex: claude-opus-5, claude-sonnet-5, claude-opus-6, claude-fable-5, etc.)
      return m;
    }

    // Se o usuário passou apenas uma palavra-chave sem "claude-"
    if (anthropicLow.includes('opus')) return 'claude-opus-5';
    if (anthropicLow.includes('sonnet')) return 'claude-sonnet-5';
    if (anthropicLow.includes('haiku')) return 'claude-haiku-4-5-20251001';
    if (anthropicLow.includes('fable')) return 'claude-fable-5';

    return `claude-${m}`;
  }

  // 2. OPENAI MAPPING
  if (provider === 'openai') {
    if (low.startsWith('gpt-5') || low.startsWith('gpt-4.1') || low.includes('luna-pro')) {
      return 'gpt-4o';
    }
    if (low.includes('gpt-4o-mini')) {
      return 'gpt-4o-mini';
    }
    if (low.includes('gpt-4o')) {
      return 'gpt-4o';
    }
    if (low.includes('o3-mini')) {
      return 'o3-mini';
    }
    if (low === 'o1' || low.startsWith('o1-')) {
      return clean;
    }
    if (low.includes('gpt-4-turbo') || low.includes('gpt-4-1106') || low.includes('gpt-4-0125')) {
      return 'gpt-4-turbo';
    }
    if (low.includes('gpt-3.5')) {
      return 'gpt-3.5-turbo';
    }
  }

  // 3. GOOGLE GEMINI MAPPING
  if (provider === 'google') {
    if (low.includes('2.0-flash') || low.includes('2-flash')) {
      return 'gemini-2.0-flash';
    }
    if (low.includes('1.5-pro')) {
      return 'gemini-1.5-pro';
    }
    if (low.includes('1.5-flash')) {
      return 'gemini-1.5-flash';
    }
  }

  // 4. GROQ MAPPING
  if (provider === 'groq') {
    if (low.includes('70b') || low.includes('llama-3.3')) {
      return 'llama-3.3-70b-versatile';
    }
    if (low.includes('8b') || low.includes('llama-3.1')) {
      return 'llama-3.1-8b-instant';
    }
    if (low.includes('mixtral')) {
      return 'mixtral-8x7b-32768';
    }
  }

  // 5. MISTRAL MAPPING
  if (provider === 'mistral') {
    if (low.includes('large')) {
      return 'mistral-large-latest';
    }
    if (low.includes('small')) {
      return 'mistral-small-latest';
    }
    if (low.includes('codestral')) {
      return 'codestral-latest';
    }
  }

  return clean;
}

export function buildProviderUrl(
  provider: SupportedProvider,
  baseUrl: string | undefined,
  model: string,
  endpoint?: string
): string {
  let rawUrl: string;
  const cleanModel = normalizeModelForProvider(provider, model);

  if (endpoint && endpoint.trim()) {
    const cleanEndpoint = endpoint.trim();
    if (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://')) {
      rawUrl = cleanEndpoint;
    } else {
      const pathWithSlash = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
      if (baseUrl && baseUrl.trim()) {
        const cleanBase = baseUrl.trim().replace(/\/+$/, '');
        rawUrl = `${cleanBase}${pathWithSlash}`;
      } else {
        const origin = PROVIDER_BASE_ORIGINS[provider] ?? 'https://api.openai.com';
        if (provider === 'groq' && pathWithSlash.startsWith('/openai/')) {
          rawUrl = `https://api.groq.com${pathWithSlash}`;
        } else {
          rawUrl = `${origin.replace(/\/+$/, '')}${pathWithSlash}`;
        }
      }
    }
  } else if (baseUrl && baseUrl.trim()) {
    rawUrl = baseUrl.trim();
  } else {
    rawUrl = DEFAULT_PROVIDER_URLS[provider] ?? DEFAULT_PROVIDER_URLS.openai;
  }

  if (rawUrl.includes('${model}')) {
    if (!cleanModel?.trim()) {
      throw new Error('Model is required for this provider endpoint');
    }

    return rawUrl.replace(/\$\{model\}/g, encodeURIComponent(cleanModel));
  }

  return rawUrl;
}


function buildProviderHeaders(
  provider: SupportedProvider,
  providerApiKey: string
) {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };


  if (provider === 'anthropic') {

    baseHeaders['x-api-key'] = providerApiKey;
    baseHeaders['anthropic-version'] = '2023-06-01';

  } else if (provider === 'google') {

    baseHeaders['x-goog-api-key'] = providerApiKey;

  } else {

    baseHeaders['Authorization'] = `Bearer ${providerApiKey}`;

  }


  return baseHeaders;
}


function normalizeUsage(usage: any) {

  const promptTokens = Number(
    usage?.prompt_tokens ??
    usage?.input_tokens ??
    usage?.input_tokens_count ??
    usage?.promptTokenCount ??
    0
  );


  const completionTokens = Number(
    usage?.completion_tokens ??
    usage?.output_tokens ??
    usage?.output_tokens_count ??
    usage?.candidatesTokenCount ??
    0
  );


  // totalTokens é sempre calculado como promptTokens + completionTokens para consistência
  const totalTokens = promptTokens + completionTokens;

  // Extração de tokens cacheados (OpenAI, Gemini, Anthropic, Grok, Mistral)
  const cachedTokens = Number(
    usage?.prompt_tokens_details?.cached_tokens ??
    usage?.cachedContentTokenCount ??
    usage?.cache_read_input_tokens ??
    0
  );

  // Extração de tokens de criação de cache (Anthropic)
  const cacheCreationTokens = Number(
    usage?.cache_creation_input_tokens ?? 0
  );

  // Extração de tokens de raciocínio / thinking (OpenAI o1/o3, Gemini thinking, Grok reasoning)
  const reasoningTokens = Number(
    usage?.completion_tokens_details?.reasoning_tokens ??
    usage?.thoughtsTokenCount ??
    0
  );


  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    reasoningTokens,
    cacheCreationTokens,
  };
}



export async function callProvider(
  options: ProviderCallOptions
): Promise<ProviderCallResult> {
  const {
    provider,
    apiKey,
    model,
    body,
    baseUrl,
    endpoint,
  } = options;

  const normalizedModel = normalizeModelForProvider(provider, model);

  const url = buildProviderUrl(
    provider,
    baseUrl,
    normalizedModel,
    endpoint
  );

  const headers = buildProviderHeaders(
    provider,
    apiKey
  );

  const supportsTemp = llmPricingService.supportsTemperature(normalizedModel, provider);

  let requestBody = {
    ...body,
    model: normalizedModel,
  };

  // Se o modelo não suportar temperatura (ex: o1, o3, claude-opus-latest) ou se for explicitamente null,
  // removemos a temperatura e parâmetros de amostragem incompatíveis
  if (!supportsTemp || body?.temperature === null) {
    delete requestBody.temperature;
    delete requestBody.top_p;
    delete requestBody.presence_penalty;
    delete requestBody.frequency_penalty;
  }

  if (requestBody.maxTokens !== undefined) {
    if (requestBody.max_tokens === undefined) {
      requestBody.max_tokens = requestBody.maxTokens;
    }
    delete requestBody.maxTokens;
  }

  /**
   * Anthropic Claude requer max_tokens obrigatório e NÃO aceita role: 'system' no array messages.
   * O system prompt deve ser enviado no parâmetro top-level `system`.
   */
  if (provider === 'anthropic') {
    if (!requestBody.max_tokens) {
      requestBody.max_tokens = 4096;
    }

    if (Array.isArray(requestBody.messages)) {
      const systemMessages = requestBody.messages.filter((m: any) => m?.role === 'system');
      const nonSystemMessages = requestBody.messages.filter((m: any) => m?.role !== 'system');

      if (systemMessages.length > 0) {
        const systemText = systemMessages
          .map((m: any) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
          .join('\n\n');
        requestBody.system = requestBody.system
          ? `${requestBody.system}\n\n${systemText}`
          : systemText;
        requestBody.messages = nonSystemMessages;
      }
    }
  }

  /**
   * Google Gemini possui formato diferente de OpenAI/Anthropic.
   * Se o cliente passar messages ou prompt e NÃO for um payload já com contents nativos nem endpoint customizado de outro tipo,
   * convertemos automaticamente para o formato contents do Gemini.
   */
  if (
    provider === 'google' &&
    !requestBody.contents &&
    (Array.isArray(body?.messages) || body?.prompt !== undefined)
  ) {
    const text = Array.isArray(body?.messages)
      ? body.messages
          .map((message: any) => {
            if (typeof message?.content === 'string') return message.content;
            if (Array.isArray(message?.content)) {
              return message.content
                .map((part: any) => (typeof part === 'string' ? part : part?.text || ''))
                .filter(Boolean)
                .join('\n');
            }
            return '';
          })
          .filter(Boolean)
          .join('\n\n')
      : body?.prompt ?? '';

    const generationConfig: Record<string, any> = {};

    if (supportsTemp && body?.temperature != null) {
      generationConfig.temperature = body.temperature;
    }

    if (body?.max_tokens != null || body?.maxTokens != null) {
      generationConfig.maxOutputTokens = body?.max_tokens ?? body?.maxTokens;
    }

    requestBody = {
      contents: [
        {
          parts: [
            {
              text,
            },
          ],
        },
      ],
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    } as any;
  }



  const startedAt = Date.now();


  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });



  let responseBody: any;


  try {

    responseBody = await response.json();

  } catch {

    responseBody = await response.text();

  }



  const latencyMs = Date.now() - startedAt;



  const usage =
    responseBody?.usage ??
    responseBody?.usageMetadata ??
    responseBody?.metadata?.usage ??
    responseBody?.data?.usage ??
    {};



  const normalizedUsage = normalizeUsage(
    usage
  );



  return {
    statusCode: response.status,
    body: responseBody,
    latencyMs,

    promptTokens:
      normalizedUsage.promptTokens,

    completionTokens:
      normalizedUsage.completionTokens,

    totalTokens:
      normalizedUsage.totalTokens,

    cachedTokens:
      normalizedUsage.cachedTokens,

    reasoningTokens:
      normalizedUsage.reasoningTokens,

    cacheCreationTokens:
      normalizedUsage.cacheCreationTokens,
  };
}