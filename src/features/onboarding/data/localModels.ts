export interface LocalModel {
  /** Stable id used for the downloaded registry. */
  id: string;
  name: string;
  /** Tagline shown under the name. */
  tagline: { ru: string; en: string };
  /** Hugging Face repo that hosts GGUF quants. Verified to exist. */
  hfRepo: string;
  /** Exact GGUF filename when known — otherwise the app picks Q4_K_M. */
  preferredFile?: string;
  /** Approximate Q4 download size, GB. Shown before the real size is known. */
  sizeGB: number;
  /** RAM needed for comfortable CPU inference with context, GB. */
  minRamGB: number;
  tags: string[];
  /** Honest caveats (runtime support, license, language). */
  note?: { ru: string; en: string };
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: "minicpm5-2b",
    name: "MiniCPM5 2B",
    tagline: {
      ru: "Лёгкая: чат, код, агенты. Запустится почти везде.",
      en: "Lightweight: chat, code, agents. Runs almost anywhere.",
    },
    hfRepo: "openbmb/MiniCPM5-2B-GGUF",
    sizeGB: 1.6,
    minRamGB: 4,
    tags: ["2B", "Q4", "Ollama-ready", "128K"],
  },
  {
    id: "lfm25-8b-a1b",
    name: "LFM2.5 8B-A1B",
    tagline: {
      ru: "MoE 8B с активными 1.5B: качество большой, скорость маленькой.",
      en: "8B MoE with 1.5B active: big-model quality at small-model speed.",
    },
    hfRepo: "LiquidAI/LFM2.5-8B-A1B-GGUF",
    sizeGB: 5,
    minRamGB: 8,
    tags: ["MoE", "Q4", "128K", "edge"],
  },
  {
    id: "omnicoder-9b",
    name: "OmniCoder 9B",
    tagline: {
      ru: "Специалист по коду и агентам (на базе Qwen).",
      en: "Code and agent specialist (Qwen-based).",
    },
    hfRepo: "Tesslate/OmniCoder-9B-GGUF",
    preferredFile: "omnicoder-9b-q4_k_m.gguf",
    sizeGB: 5.7,
    minRamGB: 10,
    tags: ["9B", "Q4_K_M", "code", "Apache-2.0"],
  },
  {
    id: "gemma4-e2b",
    name: "Gemma 4 E2B",
    tagline: {
      ru: "Открытая модель Google для телефона и ноутбука.",
      en: "Google's open model for phones and laptops.",
    },
    hfRepo: "mradermacher/gemma-4-E2B-it-uncensored-GGUF",
    sizeGB: 3.5,
    minRamGB: 8,
    tags: ["E2B", "Q4_K_M", "128K"],
    note: {
      ru: "Сборка сообщества (uncensored-квант): официальный репозиторий Google отдаёт только safetensors и требует логин.",
      en: "Community build (uncensored quant): Google's official repo only ships safetensors and requires login.",
    },
  },
  {
    id: "k2-horizon-7b",
    name: "K2-Horizon 7B",
    tagline: {
      ru: "7B с контекстом 512K: код, рассуждения, инструменты.",
      en: "7B with 512K context: code, reasoning, tool use.",
    },
    hfRepo: "NANI-Nithin/K2-Horizon-7B-GGUF",
    sizeGB: 4.5,
    minRamGB: 10,
    tags: ["7B", "Q4_K_M", "512K"],
    note: {
      ru: "Важно: нужна свежая сборка рантайма с поддержкой архитектуры K2Horizon (форк llama.cpp). В старом Ollama может не стартовать.",
      en: "Important: needs a fresh runtime with K2Horizon architecture support (llama.cpp fork). May not start in older Ollama.",
    },
  },
];
