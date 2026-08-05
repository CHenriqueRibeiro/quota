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

  calculateCost(params: {
    provider?: string;
    model?: string;
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
  }): number {
    const { provider, model, promptTokens, completionTokens, cachedTokens = 0 } = params;

    if (!model) return 0;

    const normalizedVendor = (provider || "").toLowerCase().trim();
    const normalizedModel = model.toLowerCase().trim();

    const pricesList = this.cache?.prices || [];

    // 1. Correspondência exata pelo ID completo (ex: "anthropic/claude-sonnet-5")
    let found = pricesList.find(
      (p) => p.id.toLowerCase() === normalizedModel
    );

    // 2. Correspondência pelo slug do modelo sem o vendor (ex: "claude-sonnet-5")
    if (!found) {
      found = pricesList.find(
        (p) =>
          (normalizedVendor ? p.vendor.toLowerCase() === normalizedVendor : true) &&
          extractModelSlug(p.id) === normalizedModel
      );
    }

    // 3. Correspondência parcial por inclusão no ID ou no nome
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

    if (found) {
      const inputPricePerM = Number(found.input ?? 0);
      const outputPricePerM = Number(found.output ?? 0);
      // Para leitura de cache usa input_cached; se não disponível usa preço normal de input
      const cacheReadPerM = found.input_cached !== null && found.input_cached !== undefined
        ? Number(found.input_cached)
        : inputPricePerM;

      const uncachedPrompt = Math.max(0, promptTokens - cachedTokens);
      const promptCost = (uncachedPrompt / 1_000_000) * inputPricePerM;
      const cachedCost = (cachedTokens / 1_000_000) * cacheReadPerM;
      const completionCost = (completionTokens / 1_000_000) * outputPricePerM;

      const totalCost = promptCost + cachedCost + completionCost;
      return Number(totalCost.toFixed(6));
    }

    // Modelo não cadastrado na tabela de preços — retorna 0 sem inventar valores
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
