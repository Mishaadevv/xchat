/**
 * Context window estimation and tracking.
 * Provides rough token counts and known context sizes for popular models.
 */

// ── Known context window sizes (tokens) ──────────────────────────────────────
const CONTEXT_SIZES: Record<string, number> = {
  // OpenAI
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  "o1": 200000,
  "o1-mini": 128000,
  "o1-preview": 128000,
  "o3": 200000,
  "o3-mini": 200000,
  "o4-mini": 200000,

  // Anthropic
  "claude-opus-4-20250514": 200000,
  "claude-sonnet-4-20250514": 200000,
  "claude-haiku-4-20250514": 200000,
  "claude-3-5-sonnet": 200000,
  "claude-3-5-haiku": 200000,
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,

  // Google
  "gemini-2.0-flash": 1048576,
  "gemini-2.0-flash-lite": 1048576,
  "gemini-1.5-pro": 2097152,
  "gemini-1.5-flash": 1048576,

  // Meta / Llama
  "llama-3.3-70b-versatile": 128000,
  "llama-3.1-8b-instant": 128000,
  "llama-3.1-70b-versatile": 128000,
  "llama-3.1-405b-versatile": 128000,
  "meta-llama-3.3-70b-instruct": 128000,
  "meta-llama-3.1-8b-instruct": 128000,
  "Meta-Llama-3.3-70B-Instruct": 128000,

  // Mistral
  "mistral-large": 128000,
  "mistral-medium": 32000,
  "mistral-small": 32000,
  "mixtral-8x7b-32768": 32768,
  "mixtral-8x22b": 65536,

  // DeepSeek
  "deepseek-chat": 65536,
  "deepseek-coder": 65536,
  "deepseek-v3": 65536,
  "deepseek-v4": 65536,
  "DeepSeek-V3-0324": 65536,

  // Qwen
  "qwen-turbo": 131072,
  "qwen-plus": 131072,
  "qwen-max": 32768,

  // xAI
  "grok-2": 131072,
  "grok-3": 131072,

  // Groq
  "gemma2-9b-it": 8192,

  // OpenCode Zen free
  "big-pickle": 32768,
  "mimo-v2.5-free": 32768,
  "ling-3.0-flash-fin-free": 32768,
  "nemotron-3.5-lightning-free": 32768,

  // Default fallback
  "_default": 128000,
};

// ── Token estimation ──────────────────────────────────────────────────────────

/**
 * Rough token count estimation.
 * ~4 chars per token for English, ~2 for CJK, ~3 for mixed.
 * This is a heuristic — real tokenizers vary.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Count different character types
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    // CJK Unified Ideographs + extensions
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df) ||
      (code >= 0x2a700 && code <= 0x2b73f) ||
      (code >= 0x2b740 && code <= 0x2b81f) ||
      (code >= 0x2b820 && code <= 0x2ceaf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x2f800 && code <= 0x2fa1f)
    ) {
      cjk++;
    } else {
      other++;
    }
  }

  // CJK: ~1.5 tokens per char, Other: ~4 chars per token
  const cjkTokens = Math.ceil(cjk / 1.5);
  const otherTokens = Math.ceil(other / 4);
  return cjkTokens + otherTokens;
}

/**
 * Get context window size for a model.
 */
export function getContextSize(model: string): number {
  if (!model) return CONTEXT_SIZES["_default"];

  // Exact match
  if (CONTEXT_SIZES[model]) return CONTEXT_SIZES[model];

  // Partial match (case-insensitive)
  const lower = model.toLowerCase();
  for (const [key, size] of Object.entries(CONTEXT_SIZES)) {
    if (key === "_default") continue;
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return size;
    }
  }

  return CONTEXT_SIZES["_default"];
}

/**
 * Calculate total tokens used in a message array.
 */
export function calculateContextUsage(messages: { content: string; role: string }[]): {
  used: number;
  total: number;
  percentage: number;
} {
  let totalTokens = 0;
  for (const msg of messages) {
    // Add overhead per message (role, metadata) ~4 tokens
    totalTokens += 4 + estimateTokens(msg.content);
  }
  // Add system prompt overhead estimate ~200 tokens
  totalTokens += 200;

  // For now, use default context size (will be overridden by caller)
  const total = CONTEXT_SIZES["_default"];
  return {
    used: totalTokens,
    total,
    percentage: Math.min(100, Math.round((totalTokens / total) * 100)),
  };
}

/**
 * Get context usage for specific model.
 */
export function getModelContextUsage(
  model: string,
  messages: { content: string; role: string }[]
): { used: number; total: number; percentage: number } {
  let totalTokens = 0;
  for (const msg of messages) {
    totalTokens += 4 + estimateTokens(msg.content);
  }
  totalTokens += 200; // system prompt overhead

  const total = getContextSize(model);
  return {
    used: totalTokens,
    total,
    percentage: Math.min(100, Math.round((totalTokens / total) * 100)),
  };
}
