import type { SupportedProvider } from './providers';

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


  const totalTokens = Number(
    usage?.total_tokens ??
    usage?.totalTokenCount ??
    (promptTokens + completionTokens)
  );


  return {
    promptTokens,
    completionTokens,
    totalTokens,
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



  let requestBody = {
    ...body,
    model,
  };



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
  };
}