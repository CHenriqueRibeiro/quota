import fs from "fs";
import path from "path";

export interface LLMPriceItem {
  id: string;
  vendor: string;
  name: string;
  /** Preço por 1 milhão de tokens de input (USD) */
  input: number;
  /** Preço por 1 milhão de tokens de output (USD) */
  output: number;
  /** Preço por 1 milhão de tokens de leitura em cache (USD) — null se não suportado */
  input_cached: number | null;
  /** Preço por 1 milhão de tokens de escrita em cache (USD) — null se não suportado */
  input_cache_write: number | null;
  /** Flag indicando se o modelo aceita o parâmetro temperature */
  supports_temperature: boolean;
  supported_parameters?: string[];
}

export interface LLMPricesCacheData {
  updatedAt: string;
  lastSyncTimestamp: number;
  nextSyncDueDate: string;
  totalModels: number;
  /** Lista de vendors únicos presentes no cache — gerada dinamicamente no sync */
  supportedVendors: string[];
  modelsByProvider: Record<string, Array<{ id: string; name: string; input: number; output: number; input_cached: number | null; supports_temperature: boolean }>>;
  prices: LLMPriceItem[];
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const CACHE_FILE_PATH = path.join(process.cwd(), "data", "llm-prices-cache.json");

/**
 * Converte o preço por token do OpenRouter para preço por 1 milhão de tokens.
 * OpenRouter retorna strings como "0.000002" (= $2 / MTok).
 */
function perTokenToPerMillion(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return Number(value) * 1_000_000;
}

/**
 * Extrai o vendor do ID do modelo do OpenRouter.
 * Ex: "anthropic/claude-sonnet-5" → "anthropic"
 */
function extractVendor(modelId: string): string {
  return modelId.split("/")[0]?.toLowerCase().trim() ?? "";
}

/**
 * Extrai o slug do modelo sem o prefixo do vendor.
 * Ex: "anthropic/claude-sonnet-5" → "claude-sonnet-5"
 */
function extractModelSlug(modelId: string): string {
  const parts = modelId.split("/");
  return (parts.length > 1 ? parts.slice(1).join("/") : (parts[0] ?? "")).toLowerCase().trim();
}

class LLMPricingService {
  private cache: LLMPricesCacheData | null = null;
  private isSyncing = false;

  constructor() {
    this.loadCacheFromFile();
  }

  private loadCacheFromFile() {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const content = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
        this.cache = JSON.parse(content);
      }
    } catch (error) {
      console.warn("⚠️ Não foi possível ler o cache de preços do disco:", error);
    }
  }

  private saveCacheToFile(data: LLMPricesCacheData) {
    try {
      const dir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
      this.cache = data;
    } catch (error) {
      console.error("❌ Erro ao salvar o cache de preços no disco:", error);
    }
  }

  async syncPrices(): Promise<LLMPricesCacheData> {
    if (this.isSyncing) {
      if (this.cache) return this.cache;
    }
    this.isSyncing = true;

    try {
      console.log("🔄 Buscando preços atualizados de LLM de https://openrouter.ai/api/v1/models...");
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "User-Agent": "Quota-IA/1.0" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao buscar preços de openrouter.ai`);
      }

      const rawData = await response.json() as any;
      const rawModels: any[] = Array.isArray(rawData?.data) ? rawData.data : [];

      const filteredPrices: LLMPriceItem[] = [];

      for (const model of rawModels) {
        const vendor = extractVendor(model.id ?? "");
        if (!vendor) continue;

        const pricing = model.pricing;
        if (!pricing) continue;

        // Converte de preço por token → por 1 milhão de tokens
        const inputPerM = perTokenToPerMillion(pricing.prompt);
        const outputPerM = perTokenToPerMillion(pricing.completion);

        // Modelos com preço zero em input E output são roteadores/agregadores — ignora
        if (inputPerM === 0 && outputPerM === 0) continue;

        const cacheReadPerM = pricing.input_cache_read != null
          ? perTokenToPerMillion(pricing.input_cache_read)
          : null;

        const cacheWritePerM = pricing.input_cache_write != null
          ? perTokenToPerMillion(pricing.input_cache_write)
          : null;

        // Detecção de suporte a temperatura via default_parameters e supported_parameters
        const supportedParams: string[] = Array.isArray(model.supported_parameters) ? model.supported_parameters : [];
        const defaultParams = model.default_parameters ?? {};

        const hasTempInSupported = supportedParams.length > 0 ? supportedParams.includes("temperature") : true;
        const isTempNullInDefault = defaultParams.temperature === null;
        const supportsTemperature = hasTempInSupported && !isTempNullInDefault;

        filteredPrices.push({
          id: model.id,
          vendor,
          name: model.name ?? model.id,
          input: inputPerM,
          output: outputPerM,
          input_cached: cacheReadPerM,
          input_cache_write: cacheWritePerM,
          supports_temperature: supportsTemperature,
          supported_parameters: supportedParams,
        });
      }

      // Agrupa por provider para facilitar exibição no frontend
      const modelsByProvider: Record<string, Array<{ id: string; name: string; input: number; output: number; input_cached: number | null; supports_temperature: boolean }>> = {};

      for (const p of filteredPrices) {
        (modelsByProvider[p.vendor] ??= []).push({
          id: p.id,
          name: p.name,
          input: p.input,
          output: p.output,
          input_cached: p.input_cached,
          supports_temperature: p.supports_temperature,
        });
      }

      // Lista dinâmica de vendors presentes (não mais uma lista fixa hardcodada)
      const syncedVendors = [...new Set(filteredPrices.map((p) => p.vendor))].sort();

      const now = Date.now();
      const nextSyncDueDate = new Date(now + FIVE_DAYS_MS).toISOString();

      const cacheData: LLMPricesCacheData = {
        updatedAt: new Date(now).toISOString(),
        lastSyncTimestamp: now,
        nextSyncDueDate,
        totalModels: filteredPrices.length,
        supportedVendors: syncedVendors,
        modelsByProvider,
        prices: filteredPrices,
      };

      this.saveCacheToFile(cacheData);
      console.log(
        `✅ Preços de LLM sincronizados com sucesso via OpenRouter! ` +
        `(${filteredPrices.length} modelos de ${syncedVendors.length} vendors). ` +
        `Próxima atualização: ${nextSyncDueDate}`
      );

      return cacheData;
    } catch (error) {
      console.error("❌ Erro ao sincronizar preços com openrouter.ai:", error);
      if (this.cache) return this.cache;
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  async ensureFreshPrices(): Promise<LLMPricesCacheData> {
    if (!this.cache) {
      return this.syncPrices();
    }

    const age = Date.now() - (this.cache.lastSyncTimestamp || 0);
    if (age >= FIVE_DAYS_MS) {
      console.log("⏰ Cache de preços expirou (mais de 5 dias). Atualizando...");
      return this.syncPrices();
    }

    return this.cache;
  }

  async getPrices(): Promise<LLMPricesCacheData> {
    return this.ensureFreshPrices();
  }

  private findPriceItem(provider?: string, model?: string): { input: number; output: number; input_cached?: number | null } | null {
    if (!model) return null;

    const normalizedVendor = (provider || "").toLowerCase().trim();
    const normalizedModel = model.toLowerCase().trim();
    const pricesList = this.cache?.prices || [];

    const isVendorMatch = (vA: string, vB: string) => {
      const a = vA.replace(/[^a-z0-9]/g, '');
      const b = vB.replace(/[^a-z0-9]/g, '');
      if (!a || !b || a === b) return true;
      if (a.includes('mistral') && b.includes('mistral')) return true;
      if ((a === 'groq' && (b.includes('llama') || b.includes('meta') || b.includes('groq'))) || (b === 'groq' && (a.includes('llama') || a.includes('meta') || a.includes('groq')))) return true;
      if (a.includes('anthropic') && b.includes('anthropic')) return true;
      if (a.includes('google') && b.includes('google')) return true;
      if (a.includes('openai') && b.includes('openai')) return true;
      return false;
    };

    // 1. Correspondência exata pelo ID completo
    let found = pricesList.find((p) => p.id.toLowerCase() === normalizedModel);

    // 2. Correspondência pelo slug do modelo
    if (!found) {
      found = pricesList.find(
        (p) => isVendorMatch(normalizedVendor, p.vendor) && extractModelSlug(p.id) === normalizedModel
      );
    }

    // 3. Correspondência parcial por inclusão
    if (!found) {
      found = pricesList.find(
        (p) =>
          isVendorMatch(normalizedVendor, p.vendor) &&
          (
            p.id.toLowerCase().includes(normalizedModel) ||
            normalizedModel.includes(extractModelSlug(p.id)) ||
            p.name.toLowerCase().includes(normalizedModel)
          )
      );
    }

    // 4. Normalização avançada de chaves (remove datas, -latest, pontuação)
    if (!found) {
      const cleanM = normalizedModel.replace(/[-_.:/]/g, '').replace(/latest|instruct|versatile|preview|[0-9]{8}/g, '');
      found = pricesList.find((p) => {
        if (!isVendorMatch(normalizedVendor, p.vendor)) return false;
        const pSlug = extractModelSlug(p.id).replace(/[-_.:/]/g, '').replace(/latest|instruct|versatile|preview|[0-9]{8}/g, '');
        return pSlug.includes(cleanM) || cleanM.includes(pSlug);
      });
    }

    if (found) {
      return {
        input: Number(found.input ?? 0),
        output: Number(found.output ?? 0),
        input_cached: found.input_cached
      };
    }

    // 5. Tabela de Fallback Oficial dos 5 provedores
    const FALLBACK_PRICES: Record<string, { input: number; output: number; input_cached?: number }> = {
      // Anthropic
      'claude-3-7-sonnet': { input: 3.0, output: 15.0, input_cached: 0.30 },
      'claude-3-5-sonnet': { input: 3.0, output: 15.0, input_cached: 0.30 },
      'claude-3-5-haiku': { input: 0.80, output: 4.0, input_cached: 0.08 },
      'claude-3-haiku': { input: 0.25, output: 1.25, input_cached: 0.025 },
      'claude-3-opus': { input: 15.0, output: 75.0, input_cached: 1.50 },
      // Google Gemini
      'gemini-2.0-flash': { input: 0.10, output: 0.40, input_cached: 0.025 },
      'gemini-2.0-flash-lite': { input: 0.075, output: 0.30, input_cached: 0.01875 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30, input_cached: 0.01875 },
      'gemini-1.5-pro': { input: 1.25, output: 5.0, input_cached: 0.3125 },
      'gemini-2.0-pro': { input: 1.25, output: 5.0, input_cached: 0.3125 },
      // Mistral
      'mistral-large': { input: 2.0, output: 6.0 },
      'mistral-small': { input: 0.20, output: 0.60 },
      'codestral': { input: 0.30, output: 0.90 },
      'ministral-8b': { input: 0.10, output: 0.10 },
      'ministral-3b': { input: 0.04, output: 0.04 },
      // Groq (LLaMA / Mixtral)
      'llama-3.3-70b': { input: 0.59, output: 0.79 },
      'llama-3.1-70b': { input: 0.59, output: 0.79 },
      'llama-3.1-8b': { input: 0.05, output: 0.08 },
      'llama3-70b': { input: 0.59, output: 0.79 },
      'llama3-8b': { input: 0.05, output: 0.08 },
      'mixtral-8x7b': { input: 0.24, output: 0.24 },
      // OpenAI
      'gpt-4o': { input: 2.50, output: 10.0, input_cached: 1.25 },
      'gpt-4o-mini': { input: 0.15, output: 0.60, input_cached: 0.075 },
      'o1': { input: 15.0, output: 60.0, input_cached: 7.50 },
      'o1-mini': { input: 1.10, output: 4.40, input_cached: 0.55 },
      'o3-mini': { input: 1.10, output: 4.40, input_cached: 0.55 }
    };

    for (const [key, val] of Object.entries(FALLBACK_PRICES)) {
      const cleanKey = key.replace(/[-_.:/]/g, '');
      const cleanM = normalizedModel.replace(/[-_.:/]/g, '');
      if (cleanM.includes(cleanKey) || cleanKey.includes(cleanM)) {
        return val;
      }
    }

    return null;
  }

  calculateCost(params: {
    provider?: string;
    model?: string;
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
  }): number {
    const { provider, model, promptTokens, completionTokens, cachedTokens = 0 } = params;

    if (!model) return 0;

    const priceItem = this.findPriceItem(provider, model);

    if (priceItem) {
      const inputPricePerM = Number(priceItem.input ?? 0);
      const outputPricePerM = Number(priceItem.output ?? 0);
      const cacheReadPerM = priceItem.input_cached !== null && priceItem.input_cached !== undefined
        ? Number(priceItem.input_cached)
        : inputPricePerM;

      const uncachedPrompt = Math.max(0, promptTokens - cachedTokens);
      const promptCost = (uncachedPrompt / 1_000_000) * inputPricePerM;
      const cachedCost = (cachedTokens / 1_000_000) * cacheReadPerM;
      const completionCost = (completionTokens / 1_000_000) * outputPricePerM;

      const totalCost = promptCost + cachedCost + completionCost;
      return Number(totalCost.toFixed(6));
    }

    // Modelo desconhecido
    console.warn(
      `⚠️ Modelo não encontrado na tabela de preços: provider="${provider ?? ""}", model="${model}". ` +
      `Custo registrado como 0. Execute /llm-prices/sync para atualizar a tabela.`
    );
    return 0;
  }

  supportsTemperature(model: string, provider?: string): boolean {
    if (!model) return true;
    const normalizedVendor = (provider || "").toLowerCase().trim();
    const normalizedModel = model.toLowerCase().trim();
    const pricesList = this.cache?.prices || [];

    let found = pricesList.find((p) => p.id.toLowerCase() === normalizedModel);

    if (!found) {
      found = pricesList.find(
        (p) =>
          (normalizedVendor ? p.vendor.toLowerCase() === normalizedVendor : true) &&
          extractModelSlug(p.id) === normalizedModel
      );
    }

    if (!found) {
      found = pricesList.find(
        (p) =>
          (normalizedVendor ? p.vendor.toLowerCase() === normalizedVendor : true) &&
          (
            p.id.toLowerCase().includes(normalizedModel) ||
            normalizedModel.includes(extractModelSlug(p.id)) ||
            p.name.toLowerCase().includes(normalizedModel)
          )
      );
    }

    if (found && typeof found.supports_temperature === "boolean") {
      return found.supports_temperature;
    }

    // Fallback de segurança para modelos de raciocínio conhecidos
    if (/^o[0-9]/i.test(normalizedModel) || /reasoning/i.test(normalizedModel)) {
      return false;
    }

    return true;
  }
}

export default new LLMPricingService();
