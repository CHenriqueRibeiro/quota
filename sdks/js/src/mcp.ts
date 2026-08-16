import { CollectorPayload, McpClientLike, McpTelemetryOptions, QuotaConfig } from './types';
import { extractMcpTokens, inferProviderFromModel } from './extractors';

/**
 * Normaliza e sanitiza tags recebidas como array, string ou undefined
 */
function sanitizeTags(tags: any, extraTags: string[] = []): string[] {
  let list: string[] = [];
  if (Array.isArray(tags)) {
    list = tags.map(t => String(t).trim()).filter(Boolean);
  } else if (typeof tags === 'string') {
    list = tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  const merged = [...list, ...extraTags];
  return Array.from(new Set(merged));
}

/**
 * Executa qualquer ação MCP/Tool/Agente capturando latência, tokens, status e enviando telemetria ao Quota
 */
export async function interceptMcpAction<T>(
  action: () => Promise<T>,
  options: McpTelemetryOptions = {},
  trackUsageFn: (payload: CollectorPayload) => Promise<void>
): Promise<T> {
  // Se o dev não passou uma função executável, retorna de forma segura
  if (typeof action !== 'function') {
    return action as unknown as T;
  }

  const startTime = Date.now();
  let success = true;
  let statusCode = 200;
  let responseData: any = null;

  try {
    responseData = await action();
    return responseData;
  } catch (error: any) {
    success = false;
    statusCode = Number(error?.status ?? error?.statusCode ?? error?.code) || 500;
    throw error;
  } finally {
    const latencyMs = Math.max(0, Date.now() - startTime);
    const tokens = extractMcpTokens(responseData);

    const model = options?.model || tokens.model || responseData?.model || 'mcp-tool';
    const provider = options?.provider || (options?.model ? inferProviderFromModel(options.model) : 'mcp');

    const payload: CollectorPayload = {
      provider: String(provider || 'mcp').toLowerCase(),
      model: String(model || 'mcp-tool'),
      promptTokens: Math.max(0, Number(tokens.promptTokens) || 0),
      completionTokens: Math.max(0, Number(tokens.completionTokens) || 0),
      totalTokens: Math.max(0, Number(tokens.totalTokens) || 0),
      cachedTokens: Math.max(0, Number(tokens.cachedTokens) || 0),
      reasoningTokens: Math.max(0, Number(tokens.reasoningTokens) || 0),
      latencyMs,
      statusCode,
      success,
      traceId: options?.traceId,
      billingGroup: options?.billingGroup,
      metadata: {
        agent: options?.agent,
        project: options?.project,
        environment: options?.environment,
        externalUserId: options?.externalUserId,
        requestGroup: options?.requestGroup || 'mcp',
        tags: sanitizeTags(options?.tags, ['mcp'])
      }
    };

    try {
      if (typeof trackUsageFn === 'function') {
        await trackUsageFn(payload);
      }
    } catch {
      // Silencia falha de telemetria para NUNCA travar a execução principal do dev
    }
  }
}

/**
 * Envelopa uma instância de cliente MCP (como o Client oficial do @modelcontextprotocol/sdk)
 * interceptando chamadas a callTool, request, etc.
 */
export function wrapMcpClient<T extends McpClientLike>(
  client: T,
  defaultOptions: McpTelemetryOptions = {},
  trackUsageFn: (payload: CollectorPayload) => Promise<void>
): T {
  // Se o cliente for nulo, indefinido ou não for objeto, retorna o próprio valor sem quebrar
  if (!client || (typeof client !== 'object' && typeof client !== 'function')) {
    return client;
  }

  const handler: ProxyHandler<T> = {
    get(target, propKey, receiver) {
      const originalValue = Reflect.get(target, propKey, receiver);

      if (typeof originalValue === 'function') {
        // Intercepta callTool
        if (propKey === 'callTool') {
          return async function (params: any, ...args: any[]) {
            const toolName = params?.name || 'unknown-tool';
            const mergedOptions: McpTelemetryOptions = {
              provider: defaultOptions?.provider || 'mcp',
              model: defaultOptions?.model || `tool:${toolName}`,
              agent: defaultOptions?.agent,
              project: defaultOptions?.project,
              environment: defaultOptions?.environment,
              billingGroup: defaultOptions?.billingGroup,
              tags: sanitizeTags(defaultOptions?.tags, ['mcp', `tool:${toolName}`])
            };

            return interceptMcpAction(
              () => (originalValue as Function).apply(target, [params, ...args]),
              mergedOptions,
              trackUsageFn
            );
          };
        }

        // Intercepta sampling ou requests genéricos se presentes
        if (propKey === 'createMessage' || propKey === 'sample') {
          return async function (params: any, ...args: any[]) {
            const model = params?.model || defaultOptions?.model || 'mcp-sampling';
            const mergedOptions: McpTelemetryOptions = {
              provider: defaultOptions?.provider || inferProviderFromModel(model),
              model,
              agent: defaultOptions?.agent,
              project: defaultOptions?.project,
              environment: defaultOptions?.environment,
              billingGroup: defaultOptions?.billingGroup,
              tags: sanitizeTags(defaultOptions?.tags, ['mcp-sampling'])
            };

            return interceptMcpAction(
              () => (originalValue as Function).apply(target, [params, ...args]),
              mergedOptions,
              trackUsageFn
            );
          };
        }
      }

      return originalValue;
    }
  };

  try {
    return new Proxy(client, handler);
  } catch {
    return client;
  }
}
