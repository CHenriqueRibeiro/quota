import { QuotaConfig, CollectorPayload, McpTelemetryOptions, McpClientLike } from './types';
import { detectProvider, extractMetadataFromHeaders, extractTelemetry } from './extractors';
import { wrapMcpClient, interceptMcpAction } from './mcp';

export * from './types';
export * from './extractors';
export * from './mcp';

export class Quota {
  private static config: QuotaConfig | null = null;
  private static originalFetch: typeof globalThis.fetch | null = null;
  private static isInitialized = false;

  /**
   * Tenta auto-inicializar a partir de variáveis de ambiente se disponível
   */
  private static tryAutoInit(): void {
    if (!this.config && typeof process !== 'undefined' && process.env?.QUOTA_API_KEY) {
      this.init({
        apiKey: process.env.QUOTA_API_KEY,
        project: process.env.QUOTA_PROJECT,
        agent: process.env.QUOTA_AGENT,
        environment: process.env.QUOTA_ENVIRONMENT,
        endpoint: process.env.QUOTA_ENDPOINT
      });
    }
  }

  /**
   * Inicializa o escutador do Quota e intercepta chamadas de rede para provedores de IA
   */
  public static init(config: QuotaConfig): void {
    if (!config || typeof config !== 'object') {
      return;
    }

    if (this.isInitialized) {
      if (config.debug) {
        console.log('[Quota SDK] Re-inicializando configuração...');
      }
      this.config = { ...this.config, ...config };
      return;
    }

    if (!config.apiKey) {
      console.warn('[Quota SDK] Aviso: apiKey não fornecida ao chamar Quota.init()');
      return;
    }

    this.config = {
      endpoint: process.env?.QUOTA_ENDPOINT || 'https://quota-api.up.railway.app/collector',
      ...config
    };

    this.setupFetchInterception();
    this.isInitialized = true;

    if (this.config.debug) {
      console.log(`[Quota SDK] Inicializado com sucesso. Endpoint: ${this.config.endpoint}`);
    }
  }

  /**
   * Registra manualmente um evento de uso/telemetria no Quota
   */
  public static async trackUsage(payload: CollectorPayload): Promise<void> {
    this.tryAutoInit();

    if (!this.config?.apiKey) {
      // Se não houver configuração ou apiKey, não bloqueia o fluxo do usuário
      return;
    }

    const endpoint = this.config.endpoint || process.env?.QUOTA_ENDPOINT || 'https://quota-api.up.railway.app/collector';
    const fetchImpl = this.originalFetch || globalThis.fetch;

    if (!fetchImpl) {
      return;
    }

    const metadata = {
      project: payload?.metadata?.project || this.config.project,
      agent: payload?.metadata?.agent || this.config.agent,
      environment: payload?.metadata?.environment || this.config.environment,
      externalUserId: payload?.metadata?.externalUserId,
      requestGroup: payload?.metadata?.requestGroup,
      billingGroup: payload?.billingGroup,
      tags: payload?.metadata?.tags
    };

    const finalPayload: CollectorPayload = {
      ...payload,
      metadata
    };

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(finalPayload)
      });

      if (this.config.debug) {
        console.log(`[Quota SDK] Telemetria enviada (${response.status}):`, finalPayload);
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[Quota SDK] Erro ao enviar telemetria para o collector:', error);
      }
    }
  }

  /**
   * Envelopa qualquer cliente MCP para monitorar chamadas de ferramentas e sampling automaticamente
   */
  public static wrapMcp<T extends McpClientLike>(
    client: T,
    options?: McpTelemetryOptions
  ): T {
    this.tryAutoInit();

    const defaultOptions: McpTelemetryOptions = {
      project: this.config?.project,
      agent: this.config?.agent,
      environment: this.config?.environment,
      ...options
    };

    return wrapMcpClient(client, defaultOptions, (payload) => this.trackUsage(payload));
  }

  /**
   * Executa uma ação MCP / Tool / Agente e envia telemetria ao Quota
   */
  public static async interceptMcp<T>(
    action: () => Promise<T>,
    options?: McpTelemetryOptions
  ): Promise<T> {
    this.tryAutoInit();

    const defaultOptions: McpTelemetryOptions = {
      project: this.config?.project,
      agent: this.config?.agent,
      environment: this.config?.environment,
      ...options
    };

    return interceptMcpAction(action, defaultOptions, (payload) => this.trackUsage(payload));
  }

  /**
   * Configura o monkey-patching no globalThis.fetch
   */
  private static setupFetchInterception(): void {
    if (typeof globalThis === 'undefined' || !globalThis.fetch) {
      return;
    }

    this.originalFetch = globalThis.fetch;
    const self = this;

    const patchedFetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      let urlString = '';
      try {
        urlString = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as any)?.url || '';
      } catch {
        urlString = '';
      }

      const provider = detectProvider(urlString);

      // Se a requisição não for para um provedor de IA conhecido ou for para o próprio collector, executa normalmente
      if (!provider || (self.config?.endpoint && urlString.includes(self.config.endpoint))) {
        return self.originalFetch!(input, init);
      }

      let requestBodyJson: any = null;
      if (init?.body) {
        try {
          if (typeof init.body === 'string') {
            requestBodyJson = JSON.parse(init.body);
          }
        } catch {
          // Ignora erro de parse se o corpo não for JSON
        }
      }

      const headerMetadata = extractMetadataFromHeaders(init?.headers);
      const startTime = Date.now();

      let response: Response;
      try {
        response = await self.originalFetch!(input, init);
      } catch (err) {
        throw err;
      }

      const latencyMs = Date.now() - startTime;

      // Executa a extração em micro-task para não bloquear a resposta para o cliente
      queueMicrotask(async () => {
        try {
          const clonedResponse = response.clone();
          const responseBodyJson = await clonedResponse.json();

          const defaultMetadata = {
            project: self.config?.project,
            agent: self.config?.agent,
            environment: self.config?.environment
          };

          const telemetry = extractTelemetry(
            provider,
            requestBodyJson,
            responseBodyJson,
            latencyMs,
            response.status,
            defaultMetadata,
            headerMetadata
          );

          await self.trackUsage(telemetry);
        } catch (error) {
          if (self.config?.debug) {
            console.error('[Quota SDK] Erro ao extrair dados de resposta:', error);
          }
        }
      });

      return response;
    };

    try {
      Object.assign(patchedFetch, this.originalFetch);
      globalThis.fetch = patchedFetch as typeof globalThis.fetch;
    } catch {
      // Ignora se o runtime não permitir sobrescrever globalThis.fetch
    }
  }
}
