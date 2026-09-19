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

// ── Real server usage + unified live context state ───────────────────────────

export interface LiveContextState {
  /** Tokens actually counted by the server for the last request (null when
   *  the server did not report usage — then the estimate is shown). */
  serverPromptTokens: number | null;
  serverCompletionTokens: number | null;
  /** The context window the model is actually running with right now. */
  total: number;
  /** Where `total` came from, so the UI can be honest about it. */
  totalSource: "engine" | "selected" | "model-table";
}

let liveState: LiveContextState = {
  serverPromptTokens: null,
  serverCompletionTokens: null,
  total: CONTEXT_SIZES["_default"],
  totalSource: "model-table",
};

const liveListeners = new Set<() => void>();

function notifyLive() {
  liveListeners.forEach((l) => l());
}

/** Record real token usage from the server's final stream chunk. */
export function reportServerUsage(promptTokens: number, completionTokens: number): void {
  if (!promptTokens && !completionTokens) return;
  liveState = {
    ...liveState,
    serverPromptTokens: promptTokens,
    serverCompletionTokens: completionTokens,
  };
  notifyLive();
}

/** Drop server counts — a new message/chat makes them stale, so the live
 *  estimate takes over until the next real usage arrives. */
export function resetServerUsage(): void {
  if (liveState.serverPromptTokens == null && liveState.serverCompletionTokens == null) return;
  liveState = { ...liveState, serverPromptTokens: null, serverCompletionTokens: null };
  notifyLive();
}

/** Record the context window the local engine reports it is running with. */
export function reportEngineContext(totalTokens: number): void {
  if (!totalTokens || totalTokens <= 0) return;
  if (liveState.total === totalTokens && liveState.totalSource === "engine") return;
  liveState = { ...liveState, total: totalTokens, totalSource: "engine" };
  notifyLive();
}

/** The user picked a context size for a local provider (ChatInput selector). */
export function reportSelectedContext(totalTokens: number): void {
  if (!totalTokens || totalTokens <= 0) return;
  liveState = { ...liveState, total: totalTokens, totalSource: "selected" };
  notifyLive();
}

/** Keep the window size in sync when the model changes. */
export function reportModelChanged(model: string): void {
  const total = getContextSize(model);
  if (liveState.totalSource !== "engine" && liveState.totalSource !== "selected") {
    liveState = { ...liveState, total, totalSource: "model-table" };
    notifyLive();
  }
  // A new model invalidates the previous server counts.
  liveState = { ...liveState, serverPromptTokens: null, serverCompletionTokens: null };
  notifyLive();
}

export function subscribeLiveContext(listener: () => void): () => void {
  liveListeners.add(listener);
  return () => liveListeners.delete(listener);
}

export function getLiveContextState(): LiveContextState {
  return liveState;
}

/**
 * The single source of truth both the header ring and the Context Usage panel
 * render. Server-reported tokens win; while streaming (and whenever the server
 * did not report usage) a live estimate of the visible conversation is used so
 * the number moves in real time.
 */
export function getUnifiedContextUsage(
  model: string,
  messages: { content: string; role: string }[],
  streamingContent?: string,
  selectedContextTokens?: number,
): { used: number; total: number; percentage: number; live: boolean; source: string } {
  const state = getLiveContextState();
  const total = state.totalSource === "engine" || state.totalSource === "selected"
    ? state.total
    : (selectedContextTokens && selectedContextTokens > 0 ? selectedContextTokens : state.total);

  // Estimate over the whole conversation, streaming text included — this is
  // what updates every token.
  let estimated = 0;
  for (const msg of messages) {
    estimated += 4 + estimateTokens(msg.content);
  }
  if (streamingContent) estimated += estimateTokens(streamingContent);

  const server = state.serverPromptTokens;
  const used = server != null && server > 0 ? server + (state.serverCompletionTokens ?? 0) + estimateTokens(streamingContent ?? "") : estimated;
  const source = server != null && server > 0 ? "server" : "estimate";

  return {
    used,
    total,
    percentage: Math.min(100, Math.round((used / Math.max(1, total)) * 100)),
    live: Boolean(streamingContent),
    source,
  };
}
