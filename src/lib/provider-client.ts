import type { SupportedProvider } from './providers';
import llmPricingService from '../service/llm-pricing.service';

export interface ProviderCallOptions {
  provider: SupportedProvider;
  apiKey: string;
  model: string;
  body: any;
  baseUrl?: string;
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

const DEFAULT_PROVIDER_URLS: Record<SupportedProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',

  anthropic: 'https://api.anthropic.com/v1/messages',

  google:
    'https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent',

  groq: 'https://api.groq.com/openai/v1/chat/completions',

  mistral: 'https://api.mistral.ai/v1/chat/completions',
};


function buildProviderUrl(
  provider: SupportedProvider,
  baseUrl: string | undefined,
  model: string
) {
  if (baseUrl && baseUrl.trim()) {
    return baseUrl.trim();
  }

  const template = DEFAULT_PROVIDER_URLS[provider];

  if (template.includes('${model}')) {
    if (!model?.trim()) {
      throw new Error('Model is required for this provider endpoint');
    }

    return template.replace(
      '${model}',
      encodeURIComponent(model)
    );
  }

  return template;
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
    baseUrl
  } = options;


  const url = buildProviderUrl(
    provider,
    baseUrl,
    model
  );


  const headers = buildProviderHeaders(
    provider,
    apiKey
  );


  const supportsTemp = llmPricingService.supportsTemperature(model, provider);

  let requestBody = {
    ...body,
    model,
  };

  // Se o modelo não suportar temperatura (ex: o1, o3, claude-opus-latest) ou se for explicitamente null,
  // removemos a temperatura e parâmetros de amostragem incompatíveis
  if (!supportsTemp || body?.temperature === null) {
    delete requestBody.temperature;
    delete requestBody.top_p;
    delete requestBody.presence_penalty;
    delete requestBody.frequency_penalty;
  }



  /**
   * Google Gemini possui formato diferente
   * de OpenAI/Anthropic.
   */
  if (provider === 'google') {

    const text =
      Array.isArray(body?.messages)

        ? body.messages
            .map((message: any) => message?.content)
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