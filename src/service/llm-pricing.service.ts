import fs from "fs";
import path from "path";

export interface LLMPriceItem {
  id: string;
  vendor: string;
  name: string;
  input: number;
  output: number;
  input_cached: number | null;
}

export interface LLMPricesCacheData {
  updatedAt: string;
  lastSyncTimestamp: number;
  nextSyncDueDate: string;
  totalModels: number;
  supportedVendors: string[];
  modelsByProvider: Record<string, Array<{ id: string; name: string; input: number; output: number; input_cached: number | null }>>;
  prices: LLMPriceItem[];
}

const SUPPORTED_VENDORS = ["openai", "anthropic", "google", "groq", "mistral"];
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const CACHE_FILE_PATH = path.join(process.cwd(), "data", "llm-prices-cache.json");

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
      console.log("🔄 Buscando preços atualizados de LLM de https://www.llm-prices.com/current-v1.json...");
      const response = await fetch("https://www.llm-prices.com/current-v1.json", {
        headers: { "User-Agent": "Quota-IA/1.0" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao buscar preços de llm-prices.com`);
      }

      const rawData = await response.json() as any;
      const rawPrices: LLMPriceItem[] = Array.isArray(rawData?.prices) ? rawData.prices : [];

      // Filtra apenas os provedores aceitos na nossa plataforma
      const filteredPrices = rawPrices.filter((p) =>
        SUPPORTED_VENDORS.includes(p.vendor?.toLowerCase()?.trim())
      );

      const modelsByProvider: Record<string, Array<{ id: string; name: string; input: number; output: number; input_cached: number | null }>> = {};

      for (const p of filteredPrices) {
        const v = p.vendor.toLowerCase().trim();
        if (!modelsByProvider[v]) {
          modelsByProvider[v] = [];
        }
        modelsByProvider[v].push({
          id: p.id,
          name: p.name,
          input: p.input,
          output: p.output,
          input_cached: p.input_cached
        });
      }

      const now = Date.now();
      const nextSyncDueDate = new Date(now + FIVE_DAYS_MS).toISOString();

      const cacheData: LLMPricesCacheData = {
        updatedAt: new Date(now).toISOString(),
        lastSyncTimestamp: now,
        nextSyncDueDate,
        totalModels: filteredPrices.length,
        supportedVendors: SUPPORTED_VENDORS,
        modelsByProvider,
        prices: filteredPrices
      };

      this.saveCacheToFile(cacheData);
      console.log(`✅ Preços de LLM sincronizados com sucesso! (${filteredPrices.length} modelos mantidos dos provedores aceitos). Próxima atualização: ${nextSyncDueDate}`);

      return cacheData;
    } catch (error) {
      console.error("❌ Erro ao sincronizar preços com llm-prices.com:", error);
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

    // Tenta encontrar correspondência exata do ID do modelo
    let found = pricesList.find(
      (p) => p.id.toLowerCase() === normalizedModel
    );

    // Se não encontrou por ID exato, tenta por nome ou vendor + sufixo de modelo
    if (!found) {
      found = pricesList.find(
        (p) =>
          (normalizedVendor ? p.vendor.toLowerCase() === normalizedVendor : true) &&
          (p.id.toLowerCase().includes(normalizedModel) || normalizedModel.includes(p.id.toLowerCase()) || p.name.toLowerCase().includes(normalizedModel))
      );
    }

    if (found) {
      const inputPricePerM = Number(found.input ?? 0);
      const outputPricePerM = Number(found.output ?? 0);
      const cachedPricePerM = found.input_cached !== null && found.input_cached !== undefined
        ? Number(found.input_cached)
        : inputPricePerM;

      const uncachedPrompt = Math.max(0, promptTokens - cachedTokens);
      const promptCost = (uncachedPrompt / 1_000_000) * inputPricePerM;
      const cachedCost = (cachedTokens / 1_000_000) * cachedPricePerM;
      const completionCost = (completionTokens / 1_000_000) * outputPricePerM;

      const totalCost = promptCost + cachedCost + completionCost;
      return Number(totalCost.toFixed(6));
    }

    // Fallbacks padronizados se modelo específico não constar no repositório
    let fallbackInputPerM = 2.5; // ex: $2.50 / 1M tokens
    let fallbackOutputPerM = 10.0; // ex: $10.00 / 1M tokens

    if (normalizedModel.includes("gpt-4o-mini") || normalizedModel.includes("haiku") || normalizedModel.includes("flash") || normalizedModel.includes("micro")) {
      fallbackInputPerM = 0.15;
      fallbackOutputPerM = 0.60;
    } else if (normalizedModel.includes("mini") || normalizedModel.includes("small") || normalizedModel.includes("lite")) {
      fallbackInputPerM = 0.50;
      fallbackOutputPerM = 1.50;
    }

    const promptCost = (promptTokens / 1_000_000) * fallbackInputPerM;
    const completionCost = (completionTokens / 1_000_000) * fallbackOutputPerM;

    return Number((promptCost + completionCost).toFixed(6));
  }
}

export default new LLMPricingService();
