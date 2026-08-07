import { QuotaConfig, CollectorPayload, QuotaMetadata } from './types';
import { detectProvider, extractTelemetry, extractMetadataFromHeaders } from './extractors';

export * from './types';
export * from './extractors';

export class Quota {
  private static config: QuotaConfig | null = null;
  private static originalFetch: typeof globalThis.fetch | null = null;
  private static isInitialized = false;

  /**
   * Inicializa o escutador do Quota e intercepta chamadas de rede para provedores de IA
   */
  public static init(config: QuotaConfig): void {
    if (this.isInitialized) {
      if (config.debug) {
        console.log('[Quota SDK] Re-inicializando configuração...');
      }
      this.config = { ...this.config, ...config };
      return;
    }

    if (!config.apiKey) {
      throw new Error('[Quota SDK] Erro: apiKey é obrigatória ao chamar Quota.init()');
    }

    this.config = {
      endpoint: process.env.QUOTA_ENDPOINT || 'https://quota-api.up.railway.app/collector',
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
    if (!this.config) {
      console.warn('[Quota SDK] Aviso: Quota.init() não foi chamado antes de trackUsage()');
      return;
    }

    const endpoint = this.config.endpoint || process.env.QUOTA_ENDPOINT || 'https://quota-api.up.railway.app/collector';
    const fetchImpl = this.originalFetch || globalThis.fetch;

    const metadata: QuotaMetadata = {
      project: payload.metadata?.project || this.config.project,
      agent: payload.metadata?.agent || this.config.agent,
      environment: payload.metadata?.environment || this.config.environment,
      externalUserId: payload.metadata?.externalUserId,
      requestGroup: payload.metadata?.requestGroup,
      tags: payload.metadata?.tags
    };

    const finalPayload = {
      ...payload,
      metadata
    };

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey
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
      const urlString =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.href
          : input.url;

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
        // Se a requisição de IA falhar no nível da rede, não interceptamos a falha
        throw err;
      }

      const latencyMs = Date.now() - startTime;

      // Executa a extração em micro-task para não bloquear a resposta para o cliente
      queueMicrotask(async () => {
        try {
          // Clona a resposta para não consumir o body do stream principal da aplicação
          const clonedResponse = response.clone();
          const responseBodyJson = await clonedResponse.json();

          const defaultMetadata: QuotaMetadata = {
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

    // Copia propriedades estáticas do fetch original e atribui ao globalThis
    Object.assign(patchedFetch, this.originalFetch);
    globalThis.fetch = patchedFetch as typeof globalThis.fetch;
  }
}

