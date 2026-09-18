export type ProviderType = "openai" | "anthropic" | "ollama";

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  models: string[];
  // optional metadata for UI grouping / docs
  category?: "core" | "aggregator" | "hyperscaler" | "inference" | "local" | "regional" | "china" | "enterprise";
  website?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

const STORAGE_KEY = "zeqouxchat-providers";

export const PROVIDER_CATEGORIES = {
  core: "Core / Frontier",
  aggregator: "Aggregators & Gateways",
  hyperscaler: "Hyperscaler / Free Tier",
  inference: "High-Perf Inference",
  local: "Local / Self-Hosted",
  regional: "Regional (CIS)",
  china: "China / Asia",
  enterprise: "Enterprise & Other",
} as const;

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  // ── Core frontier labs (need API key) ───────────────────────────────────
  { id: "openai",     name: "OpenAI",          type: "openai",    apiKey: "", baseUrl: "https://api.openai.com/v1",                         models: [], category: "core", website: "https://platform.openai.com" },
  { id: "anthropic",  name: "Anthropic",        type: "anthropic", apiKey: "", baseUrl: "https://api.anthropic.com/v1",                     models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-4-20250514"], category: "core", website: "https://console.anthropic.com" },
  { id: "google",     name: "Google Gemini",    type: "openai",    apiKey: "", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", models: [], category: "core", website: "https://aistudio.google.com" },
  { id: "xai",        name: "xAI (Grok)",       type: "openai",    apiKey: "", baseUrl: "https://api.x.ai/v1",                            models: [], category: "core", website: "https://console.x.ai" },
  { id: "mistral",    name: "Mistral AI",       type: "openai",    apiKey: "", baseUrl: "https://api.mistral.ai/v1",                       models: [], category: "core", website: "https://console.mistral.ai" },
  { id: "deepseek",   name: "DeepSeek",         type: "openai",    apiKey: "", baseUrl: "https://api.deepseek.com/v1",                     models: [], category: "core", website: "https://platform.deepseek.com" },
  { id: "meta",       name: "Meta (Llama API)", type: "openai",    apiKey: "", baseUrl: "https://api.llama.com/v1",                         models: [], category: "core", website: "https://llama.developer.meta.com" },

  // ── Free / No API key required ──────────────────────────────────────────
  { id: "opencodezen", name: "OpenCode Zen", type: "openai", apiKey: "", baseUrl: "https://opencode.ai/zen/v1",
    models: ["big-pickle", "mimo-v2.5-free", "ling-3.0-flash-fin-free", "nemotron-3.5-lightning-free"],
    category: "aggregator", website: "https://opencode.ai" },
  { id: "pollinations", name: "Pollinations AI", type: "openai", apiKey: "", baseUrl: "https://gen.pollinations.ai/v1",
    models: ["openai-fast"], category: "aggregator", website: "https://pollinations.ai" },

  // ── Aggregators (need API key, verified URLs) ───────────────────────────
  { id: "openrouter", name: "OpenRouter",       type: "openai",    apiKey: "", baseUrl: "https://openrouter.ai/api/v1",                    models: ["google/gemma-2-9b-it:free", "meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free"], category: "aggregator", website: "https://openrouter.ai" },
  { id: "aihubmix",   name: "AIHubMix",         type: "openai",    apiKey: "", baseUrl: "https://api.aihubmix.com/v1",                     models: [], category: "aggregator", website: "https://aihubmix.com" },
  { id: "chadapi",    name: "ChadAPI (chadgpt.ru)", type: "openai", apiKey: "", baseUrl: "https://api.chadgpt.ru/v1",                  models: [], category: "regional", website: "https://api.chadgpt.ru" },

  // ── Free tier / Hyperscaler (need API key, fast inference) ──────────────
  { id: "groq",       name: "Groq",             type: "openai",    apiKey: "", baseUrl: "https://api.groq.com/openai/v1",                  models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"], category: "hyperscaler", website: "https://console.groq.com" },
  { id: "cerebras",   name: "Cerebras",         type: "openai",    apiKey: "", baseUrl: "https://api.cerebras.ai/v1",                      models: ["llama-3.3-70b", "llama-3.1-8b"], category: "hyperscaler", website: "https://cloud.cerebras.ai" },
  { id: "sambanova",  name: "SambaNova",        type: "openai",    apiKey: "", baseUrl: "https://api.sambanova.ai/v1",                     models: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-V3-0324"], category: "hyperscaler", website: "https://cloud.sambanova.ai" },
  { id: "huggingface",name: "HuggingFace",      type: "openai",    apiKey: "", baseUrl: "https://router.huggingface.co/v1",                  models: [], category: "hyperscaler", website: "https://huggingface.co" },
  { id: "nvidia",     name: "NVIDIA NIM",       type: "openai",    apiKey: "", baseUrl: "https://integrate.api.nvidia.com/v1",              models: [], category: "hyperscaler", website: "https://build.nvidia.com" },

  // ── Inference (need API key) ────────────────────────────────────────────
  { id: "together",   name: "Together AI",      type: "openai",    apiKey: "", baseUrl: "https://api.together.xyz/v1",                     models: [], category: "inference", website: "https://together.ai" },
  { id: "fireworks",  name: "Fireworks AI",     type: "openai",    apiKey: "", baseUrl: "https://api.fireworks.ai/inference/v1",           models: [], category: "inference", website: "https://fireworks.ai" },
  { id: "deepinfra",  name: "DeepInfra",        type: "openai",    apiKey: "", baseUrl: "https://api.deepinfra.com/v1/openai",              models: [], category: "inference", website: "https://deepinfra.com" },
  { id: "siliconflow",name: "SiliconFlow",      type: "openai",    apiKey: "", baseUrl: "https://api.siliconflow.cn/v1",                   models: [], category: "inference", website: "https://siliconflow.com" },
  { id: "novita",     name: "Novita AI",        type: "openai",    apiKey: "", baseUrl: "https://api.novita.ai/v3/openai",                  models: [], category: "inference", website: "https://novita.ai" },
  { id: "hyperbolic", name: "Hyperbolic",       type: "openai",    apiKey: "", baseUrl: "https://api.hyperbolic.xyz/v1",                   models: [], category: "inference", website: "https://hyperbolic.xyz" },

  // ── Enterprise (need API key) ───────────────────────────────────────────
  { id: "cohere",     name: "Cohere",           type: "openai",    apiKey: "", baseUrl: "https://api.cohere.com/compatibility/v1",         models: [], category: "enterprise", website: "https://cohere.com" },

  // ── China / Asia (need API key) ─────────────────────────────────────────
  { id: "qwen",       name: "Alibaba Qwen",     type: "openai",    apiKey: "", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: [], category: "china", website: "https://dashscope.console.aliyun.com" },
  { id: "zhipu",      name: "Zhipu AI (GLM)",   type: "openai",    apiKey: "", baseUrl: "https://open.bigmodel.cn/api/paas/v4",             models: [], category: "china", website: "https://open.bigmodel.cn" },
  { id: "moonshot",   name: "Moonshot (Kimi)",  type: "openai",    apiKey: "", baseUrl: "https://api.moonshot.cn/v1",                       models: [], category: "china", website: "https://platform.moonshot.cn" },
  { id: "minimax",    name: "MiniMax",          type: "openai",    apiKey: "", baseUrl: "https://api.minimax.chat/v1",                      models: [], category: "china", website: "https://platform.minimaxi.com" },
  { id: "lingyi",     name: "01.AI (Yi)",       type: "openai",    apiKey: "", baseUrl: "https://api.lingyiwanwu.com/v1",                   models: [], category: "china", website: "https://platform.lingyiwanwu.com" },

  // ── Regional / CIS (need API key) ───────────────────────────────────────
  { id: "bothub",     name: "BotHub",           type: "openai",    apiKey: "", baseUrl: "https://bothub.chat/api/v2/openai/v1",            models: [], category: "regional", website: "https://bothub.chat" },

  // ── Local / Self-hosted (no API key needed) ─────────────────────────────
  { id: "ollama",     name: "Ollama (local)",   type: "ollama",    apiKey: "", baseUrl: "http://localhost:11434",                          models: [], category: "local", website: "https://ollama.com" },
  { id: "lmstudio",   name: "LM Studio",        type: "openai",    apiKey: "", baseUrl: "http://localhost:1234/v1",                        models: [], category: "local", website: "https://lmstudio.ai" },
  { id: "vllm",       name: "vLLM",             type: "openai",    apiKey: "", baseUrl: "http://localhost:8000/v1",                        models: [], category: "local", website: "https://docs.vllm.ai" },
  { id: "localai",    name: "LocalAI",          type: "openai",    apiKey: "", baseUrl: "http://localhost:8080/v1",                        models: [], category: "local", website: "https://localai.io" },
  { id: "koboldcpp",  name: "KoboldCpp",        type: "openai",    apiKey: "", baseUrl: "http://localhost:5001/v1",                        models: [], category: "local", website: "https://github.com/LostRuins/koboldcpp" },
  { id: "textgenwebui", name: "TextGen WebUI",   type: "openai",    apiKey: "", baseUrl: "http://localhost:5000/v1",                        models: [], category: "local", website: "https://github.com/oobabooga/text-generation-webui" },
  { id: "jan",        name: "Jan",              type: "openai",    apiKey: "", baseUrl: "http://localhost:1337/v1",                        models: [], category: "local", website: "https://jan.ai" },
  { id: "llamacpp",   name: "llama.cpp server", type: "openai",    apiKey: "", baseUrl: "http://localhost:8080/v1",                        models: [], category: "local", website: "https://github.com/ggerganov/llama.cpp" },
  { id: "openwebui",  name: "Open WebUI",       type: "openai",    apiKey: "", baseUrl: "http://localhost:3000/api/v1",                    models: [], category: "local", website: "https://openwebui.com" },
  { id: "gpt4all",    name: "GPT4All",          type: "openai",    apiKey: "", baseUrl: "http://localhost:4891/v1",                        models: [], category: "local", website: "https://gpt4all.io" },
  { id: "tabbyapi",   name: "TabbyAPI",         type: "openai",    apiKey: "", baseUrl: "http://localhost:5000/v1",                        models: [], category: "local", website: "https://github.com/theroyallab/tabbyAPI" },
  { id: "aphrodite",  name: "Aphrodite Engine", type: "openai",    apiKey: "", baseUrl: "http://localhost:2242/v1",                        models: [], category: "local", website: "https://github.com/PygmalionAI/aphrodite-engine" },
  { id: "exo",        name: "Exo (distributed)", type: "openai",   apiKey: "", baseUrl: "http://localhost:52415/v1",                      models: [], category: "local", website: "https://github.com/exo-explore/exo" },
  { id: "serge",      name: "Serge",            type: "openai",    apiKey: "", baseUrl: "http://localhost:8008/v1",                        models: [], category: "local", website: "https://github.com/serge-chat/serge" },
];

function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved: ProviderConfig[] = JSON.parse(raw);
      let changed = false;
      const savedIds = new Set(saved.map((p) => p.id));
      for (const def of DEFAULT_PROVIDERS) {
        if (!savedIds.has(def.id)) {
          saved.push({ ...def });
          savedIds.add(def.id);
          changed = true;
        }
      }
      // migrate legacy: ensure fields exist
      for (const p of saved) {
        if (!p.category) {
          const def = DEFAULT_PROVIDERS.find(d => d.id === p.id);
          if (def?.category) { p.category = def.category as any; changed = true; }
        }
        if (!p.website) {
          const def = DEFAULT_PROVIDERS.find(d => d.id === p.id);
          if (def?.website) { p.website = def.website; changed = true; }
        }
      }
      if (changed) {
        saveProviders(saved);
      }
      return saved;
    }
  } catch {}
  return DEFAULT_PROVIDERS.map((p) => ({ ...p }));
}

function saveProviders(providers: ProviderConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
}

let providersCache: ProviderConfig[] | null = null;

function getProviders(): ProviderConfig[] {
  if (!providersCache) providersCache = loadProviders();
  return providersCache;
}

function persist() {
  saveProviders(getProviders());
}

async function discoverOpenAIModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/models`, { headers });
    if (!res.ok) {
      // Some providers use /v1/models at a different path — try common alternatives
      const altRes = await fetch(`${cleanUrl.replace(/\/v1$/, "")}/models`, { headers });
      if (!altRes.ok) return [];
      const altData = await altRes.json();
      if (altData.data && Array.isArray(altData.data)) {
        return altData.data.map((m: any) => m.id || m.name).filter(Boolean);
      }
      return [];
    }
    const data = await res.json();
    // Standard OpenAI format: { data: [{ id: "..." }] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => m.id || m.name).filter(Boolean);
    }
    // Some providers: { objects: [{ id: "..." }] }
    if (data.objects && Array.isArray(data.objects)) {
      return data.objects.map((m: any) => m.id || m.name).filter(Boolean);
    }
    // Some providers: { models: [{ id: "..." }] }
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((m: any) => m.id || m.name || m).filter(Boolean);
    }
    // Flat array of strings
    if (Array.isArray(data)) {
      return data.map((m: any) => typeof m === 'string' ? m : m.id || m.name).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

async function discoverOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

async function detectProviderType(baseUrl: string): Promise<ProviderType> {
  try {
    const ollamaRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (ollamaRes.ok) return "ollama";
  } catch {}
  return "openai";
}

export const providerService = {
  getProviders: () => [...getProviders()],

  getProvider: (id: string) => getProviders().find((p) => p.id === id) ?? null,

  getProvidersByCategory: (category: string) => getProviders().filter((p) => p.category === category),

  getCategories: () => [...new Set(getProviders().map((p) => p.category).filter(Boolean))] as string[],

  updateProvider: (id: string, updates: Partial<ProviderConfig>) => {
    const list = getProviders();
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      persist();
    }
  },

  setApiKey: (id: string, apiKey: string) => {
    providerService.updateProvider(id, { apiKey });
  },

  async refreshModels(providerId: string): Promise<string[]> {
    const provider = getProviders().find((p) => p.id === providerId);
    if (!provider) return [];

    let models: string[] = [];
    if (provider.type === "ollama") {
      models = await discoverOllamaModels(provider.baseUrl);
    } else if (provider.type === "openai") {
      models = await discoverOpenAIModels(provider.baseUrl, provider.apiKey);
    }

    if (models.length > 0) {
      providerService.updateProvider(providerId, { models });
    }
    return models;
  },

  async refreshAllModels(): Promise<void> {
    for (const p of getProviders()) {
      if (p.apiKey || p.type === "ollama") {
        await providerService.refreshModels(p.id);
      }
    }
  },

  async addProvider(name: string, baseUrl: string, apiKey: string): Promise<ProviderConfig> {
    const trimmedUrl = baseUrl.replace(/\/+$/, "");
    const type = await detectProviderType(trimmedUrl);

    const provider: ProviderConfig = {
      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
      name,
      type,
      apiKey,
      baseUrl: trimmedUrl,
      models: [],
      category: "enterprise",
    };

    const list = getProviders();
    list.push(provider);
    persist();

    if (type === "ollama" || apiKey) {
      const models = type === "ollama"
        ? await discoverOllamaModels(trimmedUrl)
        : await discoverOpenAIModels(trimmedUrl, apiKey);
      if (models.length > 0) {
        provider.models = models;
        persist();
      }
    }

    return provider;
  },

  removeProvider: (id: string) => {
    const list = getProviders();
    providersCache = list.filter((p) => p.id !== id);
    saveProviders(providersCache);
  },

  getConfiguredProviders: () => getProviders().filter((p) => p.apiKey.length > 0 || p.type === "ollama"),

  getAllModels: (): ModelInfo[] => {
    const result: ModelInfo[] = [];
    for (const p of getProviders()) {
      for (const m of p.models) {
        result.push({ id: m, name: m, provider: p.id });
      }
    }
    return result;
  },

  /** Auto-detect Ollama on localhost and refresh its models */
  async autoDetectOllama(): Promise<boolean> {
    try {
      const models = await discoverOllamaModels("http://localhost:11434");
      if (models.length > 0) {
        providerService.updateProvider("ollama", { models });
        return true;
      }
    } catch {}
    return false;
  },

  /** Auto-refresh Ollama and providers with API keys */
  async autoRefreshFreeProviders(): Promise<void> {
    // Try to refresh Ollama (always works without API key)
    await providerService.autoDetectOllama();
    // Refresh any provider that has an API key but empty models
    for (const p of getProviders()) {
      if (p.apiKey && p.models.length === 0 && p.type !== "ollama") {
        try { await providerService.refreshModels(p.id); } catch {}
      }
    }
  },

  /** Check if any provider has models available */
  hasAnyModels(): boolean {
    return getProviders().some((p) => p.models.length > 0);
  },

  /** Get a user-friendly status message about provider readiness */
  getSetupStatus(): { ready: boolean; message: string } {
    const ollama = getProviders().find((p) => p.id === "ollama");
    const withKey = getProviders().filter((p) => p.apiKey.length > 0 && p.models.length > 0);
    const withModels = getProviders().filter((p) => p.models.length > 0);

    if (ollama && ollama.models.length > 0) {
      return { ready: true, message: `Ollama: ${ollama.models.length} models` };
    }
    if (withKey.length > 0) {
      return { ready: true, message: `${withKey.length} providers configured` };
    }
    if (withModels.length > 0) {
      return { ready: false, message: `Found ${withModels.length} providers — add API keys to use them` };
    }
    return { ready: false, message: "No models available. Set up Ollama locally or add an API key in Settings." };
  },
};
