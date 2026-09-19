import type { Message } from "@/core/types";
import { providerService, type ProviderConfig } from "./providers";
import { executeMCPStep, type ToolDefinition, type MCPFileInput } from "./mcp";

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
  /** Real token usage reported by the server (prompt/completion tokens). */
  onUsage?: (usage: TokenUsage) => void;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface StreamOptions {
  temperature?: number;
  systemPrompt?: string;
  projectPath?: string;
  /** Abort this generation (Stop button, chat switch, regenerate). */
  signal?: AbortSignal;
}

// One live generation at a time — chatStore aborts it on Stop/switch/regenerate.
let activeStreamAbort: AbortController | null = null;

// Tool-call rounds per generation — small local models loop tools forever.
const MAX_TOOL_ROUNDS = 6;
let toolRound = 0;

export function abortActiveStream() {
  try { activeStreamAbort?.abort(); } catch {}
  activeStreamAbort = null;
}

function buildOpenAIMessages(messages: Message[], systemPrompt?: string) {
  const result: any[] = [];
  if (systemPrompt) result.push({ role: "system", content: systemPrompt });
  for (const m of messages) {
    if (m.role === "system") { result.push({ role: "system", content: m.content }); continue; }
    // Vision support: if message has image attachments, send content as array with image_url
    const hasImages = (m as any).attachments && Array.isArray((m as any).attachments) && (m as any).attachments.some((a: any) => a.type === "image" && a.url);
    if (hasImages) {
      const parts: any[] = [{ type: "text", text: m.content }];
      for (const att of (m as any).attachments) {
        if (att.type === "image" && att.url) {
          parts.push({ type: "image_url", image_url: { url: att.url } });
        } else if (att.content) {
          // For text files, we already inject via systemPrompt, but also add as text part
          parts.push({ type: "text", text: `\n[File ${att.name}]:\n${att.content.slice(0, 4000)}` });
        }
      }
      const entry: any = { role: m.role, content: parts };
      if (m.role === "tool") entry.tool_call_id = m.toolCallId;
      result.push(entry);
      continue;
    }
    const entry: any = { role: m.role, content: m.content };
    if (m.role === "tool") {
      entry.tool_call_id = m.toolCallId;
    }
    result.push(entry);
  }
  return result;
}

interface ToolCallAccumulator {
  index: number;
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

// ── Vision payload converters ────────────────────────────────────────────
// OpenAI parts, Ollama { content, images[] } and Anthropic blocks all differ.
// These keep images working instead of silently dropping them.

function dataUrlToAnthropic(url: string): { media_type: string; data: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(url || "");
  if (!match) return null;
  return { media_type: match[1], data: match[2] };
}

/** OpenAI-style messages → Ollama /api/chat ({ content: string, images?: [] }). */
function toOllamaMessages(messages: any[]): any[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", content: typeof m.content === "string" ? m.content : "" };
    }
    if (Array.isArray(m.content)) {
      const text = m.content
        .filter((p: any) => p?.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text)
        .join("\n");
      const images = m.content
        .filter((p: any) => p?.type === "image_url" && p?.image_url?.url)
        .map((p: any) => p.image_url.url);
      const out: any = { role: m.role, content: text };
      if (images.length > 0) out.images = images;
      if (m.tool_calls) out.tool_calls = m.tool_calls;
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
      return out;
    }
    return m;
  });
}

/** data: URL image attachments → Anthropic image blocks. */
function anthropicImageBlocks(attachments: any[]): any[] {
  const blocks: any[] = [];
  for (const att of attachments || []) {
    if (att?.type !== "image" || !att?.url) continue;
    const parsed = dataUrlToAnthropic(att.url);
    if (parsed) {
      blocks.push({ type: "image", source: { type: "base64", ...parsed } });
    }
  }
  return blocks;
}

// ── Anthropic tool conversion ─────────────────────────────────────────────
function toAnthropicTools(tools?: ToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters || { type: "object", properties: {} },
  }));
}
function buildAnthropicMessages(messages: { role: string; content: any; tool_call_id?: string; tool_calls?: any[]; attachments?: any[] }[], systemPrompt?: string) {
  // For anthropic, system is separate; here we just map messages.
  // Tool messages become user tool_result blocks.
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue; // handled via system param
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }],
      });
    } else if ((m as any).tool_calls && (m as any).tool_calls.length > 0) {
      // assistant with tool_use
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of (m as any).tool_calls) {
        let input: any = {};
        try { input = JSON.parse(tc.function.arguments); } catch {}
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
      }
      out.push({ role: "assistant", content: blocks });
    } else {
      // Text + attached images (data: URLs become image blocks; remote URLs can't — say so).
      const blocks: any[] = [];
      if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p?.type === "text" && typeof p.text === "string") {
            blocks.push({ type: "text", text: p.text });
          } else if (p?.type === "image_url" && p?.image_url?.url) {
            const parsed = dataUrlToAnthropic(p.image_url.url);
            if (parsed) {
              blocks.push({ type: "image", source: { type: "base64", ...parsed } });
            } else {
              blocks.push({ type: "text", text: `[attached image skipped — Anthropic needs base64 data, got URL: ${String(p.image_url.url).slice(0, 120)}]` });
            }
          }
        }
      } else if (m.content) {
        blocks.push({ type: "text", text: m.content });
      }
      blocks.push(...anthropicImageBlocks((m as any).attachments));
      out.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: blocks.length === 1 && blocks[0].type === "text" ? blocks[0].text : blocks,
      });
    }
  }
  return out;
}

async function streamOpenAI(
  provider: ProviderConfig,
  model: string,
  messages: { role: string; content: string; tool_call_id?: string; tool_calls?: any[] }[],
  callbacks: StreamCallbacks,
  options?: StreamOptions,
  tools?: ToolDefinition[]
) {
  options?.signal?.throwIfAborted?.();
  const body: Record<string, any> = {
    model,
    messages,
    stream: true,
    temperature: options?.temperature ?? 0.7,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
    console.log('[MCP] Sending tools to API:', tools.map(t => t.function.name));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;
  if (provider.id === "openrouter") headers["HTTP-Referer"] = "https://zeqouxchat.app";

  const response = await fetch(`${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    // AIHubMix / free pool rate limit
    if (errText.includes("prevent abuse") || errText.includes("recharge") || errText.includes("aihubmix.com/topup") || errText.toLowerCase().includes("free quota")) {
      throw new Error(`Провайдер ${provider.name} временно ограничил free-quota (429). Попробуй другой провайдер (OpenRouter, Groq, Together) или пополни баланс: https://console.aihubmix.com/topup — ${errText.slice(0, 250)}`);
    }
    // Если провайдер не поддерживает tools — ретрай без них (AIHubMix free, некоторые агрегаторы)
    const lower = errText.toLowerCase();
    if (tools && tools.length > 0 && (lower.includes("tool") || lower.includes("function") || lower.includes("unsupported") || response.status === 400 || response.status === 422)) {
      console.warn(`[MCP] ${provider.name} не принял tools (${response.status}), ретрай без tools:`, errText.slice(0, 200));
      // one-time retry without tools to avoid loop
      return streamOpenAI(provider, model, messages, callbacks, options, undefined);
    }
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  const toolCalls: Map<number, ToolCallAccumulator> = new Map();
  let finishReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta || {};
        finishReason = choice.finish_reason || finishReason;

        if (delta.content) {
          fullText += delta.content;
          callbacks.onToken(delta.content);
        }

        // llama.cpp, vLLM, LM Studio, OpenRouter, Groq and most OpenAI-compatible
        // servers include real token usage on the final streaming chunk.
        if (parsed.usage && callbacks.onUsage) {
          callbacks.onUsage({
            prompt_tokens: Number(parsed.usage.prompt_tokens) || 0,
            completion_tokens: Number(parsed.usage.completion_tokens) || 0,
            total_tokens: Number(parsed.usage.total_tokens) || 0,
          });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            let acc = toolCalls.get(tc.index);
            if (!acc) {
              acc = { index: tc.index, id: "", type: "function", function: { name: "", arguments: "" } };
              toolCalls.set(tc.index, acc);
            }
            if (tc.id) acc.id += tc.id;
            if (tc.function?.name) acc.function.name += tc.function.name;
            if (tc.function?.arguments) acc.function.arguments += tc.function.arguments;
          }
        }
      } catch {}
    }
  }

  // Fix: Tool may appear intermittently because some providers send tool_calls without finish_reason="tool_calls" or with delayed signal.
  // Always execute if we accumulated any tool calls, regardless of finishReason, to ensure deterministic display.
  // Guarded by MAX_TOOL_ROUNDS so small local models can't loop tools forever.
  if (toolCalls.size > 0) {
    toolRound++;
    if (toolRound > MAX_TOOL_ROUNDS) {
      fullText += (fullText ? "\n\n" : "") + `[Tool limit reached (${MAX_TOOL_ROUNDS} rounds) — answering with collected results.]`;
    } else {
    if (finishReason !== "tool_calls") console.log('[MCP] Received tool_calls without official finish_reason:', finishReason, '— still executing', toolCalls.size, 'calls');
    else console.log('[MCP] Received tool_calls:', toolCalls.size, 'calls');
    const assistantMsg: { role: string; content: string; tool_calls: any[] } = {
      role: "assistant",
      content: fullText || "",
      tool_calls: [],
    };

    for (const [, tc] of toolCalls) {
      const fn = tc.function;
      assistantMsg.tool_calls.push({
        id: tc.id,
        type: "function",
        function: { name: fn.name, arguments: fn.arguments },
      });
    }

    messages.push(assistantMsg);

    for (const [, tc] of toolCalls) {
      const fn = tc.function;
      let parsedArgs: Record<string, any> = {};
      try { parsedArgs = JSON.parse(fn.arguments); } catch {}

      console.log('[MCP] Executing tool:', fn.name, 'with args:', parsedArgs);
      callbacks.onToken(`\n\n<!--TOOL_CALL:${fn.name}:${encodeURIComponent(JSON.stringify(parsedArgs))}-->\n\n`);

      const toolInput: MCPFileInput = {
        ...(parsedArgs as MCPFileInput),
        projectPath: options?.projectPath,
      };
      const result = await executeMCPStep(fn.name, toolInput);
      console.log('[MCP] Tool result:', result.success ? 'Success' : 'Failed', result.error || '');

      const resultText = result.success ? result.output.slice(0, 3000) : `Error: ${result.error}`;
      callbacks.onToken(`<!--TOOL_RESULT:${result.success}:${encodeURIComponent(resultText)}-->\n\n`);

      messages.push({
        role: "tool",
        content: resultText,
        tool_call_id: tc.id,
      });
    }

    console.log('[MCP] Continuing stream after tool execution...');
    const continued = await streamOpenAI(provider, model, messages, callbacks, options, tools);
    console.log('[MCP] Continued response length:', continued?.length || 0);
    if (continued) {
      fullText += (fullText ? "\n\n" : "") + continued;
    } else if (!fullText) {
      const names = [...toolCalls.values()].map((t) => t.function.name).filter(Boolean).join(", ");
      fullText = names ? `Tools executed: ${names}.` : "Tools executed successfully.";
    }
    } // else: tool rounds remaining
  }

  return fullText;
}

/** Anthropic reports input tokens in message_start and output tokens in
 *  message_delta — combine them into one OpenAI-shaped usage event. */
function emitAnthropicUsage(
  onUsage: (usage: TokenUsage) => void,
  usage: { input_tokens?: number; output_tokens?: number }
) {
  const prompt = Number(usage.input_tokens) || 0;
  const completion = Number(usage.output_tokens) || 0;
  if (!prompt && !completion) return;
  onUsage({
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  });
}

async function streamAnthropic(
  provider: ProviderConfig,
  model: string,
  messages: { role: string; content: string; tool_call_id?: string; tool_calls?: any[] }[],
  callbacks: StreamCallbacks,
  options?: StreamOptions,
  tools?: ToolDefinition[]
) {
  options?.signal?.throwIfAborted?.();
  const anthropicTools = toAnthropicTools(tools);
  if (anthropicTools) console.log('[MCP] Sending tools to Anthropic:', anthropicTools.map((t:any)=>t.name));
  const body: any = {
    model,
    max_tokens: 4096,
    stream: true,
    temperature: options?.temperature ?? 0.7,
    messages: buildAnthropicMessages(messages, options?.systemPrompt),
  };
  if (options?.systemPrompt) body.system = options.systemPrompt;
  if (anthropicTools) body.tools = anthropicTools;

  const response = await fetch(`${provider.baseUrl.replace(/\/+$/, "")}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    if (errText.toLowerCase().includes("tool") && tools && tools.length > 0) {
      console.warn(`[MCP-Anthropic] ${provider.name} не принял tools, ретрай без них:`, errText.slice(0,200));
      return streamAnthropic(provider, model, messages, callbacks, options, undefined);
    }
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  // for tool_use accumulation
  const toolCalls: Map<number, { id: string; name: string; json: string }> = new Map();
  let currentToolIndex: number | null = null;
  let stopReason: string | null = null;
  let lastAnthropicUsage: any = {};

  while (true) {
    const { done, value } = await reader.read();
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        // handle different event types
        if (parsed.type === "content_block_delta") {
          const delta = parsed.delta;
          if (delta?.type === "text_delta" && delta.text) {
            fullText += delta.text;
            callbacks.onToken(delta.text);
          } else if (delta?.type === "input_json_delta" && delta.partial_json) {
            if (currentToolIndex !== null) {
              const acc = toolCalls.get(currentToolIndex);
              if (acc) acc.json += delta.partial_json;
            }
          } else if (parsed.delta?.text) { // fallback
            const text = parsed.delta.text;
            fullText += text;
            callbacks.onToken(text);
          }
        } else if (parsed.type === "content_block_start") {
          const block = parsed.content_block;
          if (block?.type === "tool_use") {
            const idx = parsed.index ?? toolCalls.size;
            currentToolIndex = idx;
            toolCalls.set(idx, { id: block.id, name: block.name, json: "" });
          }
        } else if (parsed.type === "content_block_stop") {
          currentToolIndex = null;
        } else if (parsed.type === "message_delta") {
          stopReason = parsed.delta?.stop_reason || null;
          // Real usage arrives with message_delta (usage.output_tokens) or
          // message_start (usage.input_tokens).
          if (callbacks.onUsage) {
            const usage: any = { ...lastAnthropicUsage };
            if (parsed.usage?.output_tokens) usage.output_tokens = parsed.usage.output_tokens;
            if (usage.input_tokens || usage.output_tokens) emitAnthropicUsage(callbacks.onUsage, usage);
          }
        } else if (parsed.type === "message_start") {
          if (parsed.message?.usage && callbacks.onUsage) {
            lastAnthropicUsage = { ...(parsed.message.usage as any) };
          }
        } else if (parsed.type === "message_stop") {
          // end
        } else if (parsed.delta?.text) {
          // generic
          const text = parsed.delta.text;
          fullText += text;
          callbacks.onToken(text);
        }
      } catch {}
    }
  }

  // Fix: deterministic display — if any tool_use was started, execute it even if stopReason missing
  // Guarded by MAX_TOOL_ROUNDS so small local models can't loop tools forever.
  if (toolCalls.size > 0) {
    toolRound++;
    if (toolRound > MAX_TOOL_ROUNDS) {
      fullText += (fullText ? "\n\n" : "") + `[Tool limit reached (${MAX_TOOL_ROUNDS} rounds) — answering with collected results.]`;
    } else {
    if (stopReason !== "tool_use") console.log('[MCP-Anthropic] tool_calls without stop_reason tool_use:', stopReason, '— still executing');
    else console.log('[MCP-Anthropic] Received tool_calls:', toolCalls.size);
    const assistantMsg: any = {
      role: "assistant",
      content: fullText || "",
      tool_calls: [],
    };
    // also push as anthropic tool_use blocks for continuation, but we use openai-style tool_calls for loop
    for (const [, tc] of toolCalls) {
      assistantMsg.tool_calls.push({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.json },
      });
    }
    messages.push(assistantMsg);

    for (const [, tc] of toolCalls) {
      let parsedArgs: Record<string, any> = {};
      try { parsedArgs = JSON.parse(tc.json); } catch {}
      console.log('[MCP] Executing anthropic tool:', tc.name, parsedArgs);
      callbacks.onToken(`\n\n<!--TOOL_CALL:${tc.name}:${encodeURIComponent(JSON.stringify(parsedArgs))}-->\n\n`);
      const toolInput: MCPFileInput = { ...(parsedArgs as MCPFileInput), projectPath: options?.projectPath };
      const result = await executeMCPStep(tc.name, toolInput);
      console.log('[MCP] Tool result:', result.success ? 'Success' : 'Failed');
      const resultText = result.success ? result.output.slice(0, 3000) : `Error: ${result.error}`;
      callbacks.onToken(`<!--TOOL_RESULT:${result.success}:${encodeURIComponent(resultText)}-->\n\n`);
      messages.push({ role: "tool", content: resultText, tool_call_id: tc.id });
    }
    console.log('[MCP-Anthropic] Continuing stream after tool execution...');
    const continued = await streamAnthropic(provider, model, messages, callbacks, options, tools);
    if (continued) fullText += (fullText ? "\n\n" : "") + continued;
    else if (!fullText) {
      const names = [...toolCalls.values()].map((t) => t.name).filter(Boolean).join(", ");
      fullText = names ? `Tools executed: ${names}.` : "Tools executed successfully.";
    }
    } // else: tool rounds remaining
  }

  return fullText;
}

async function streamOllama(
  provider: ProviderConfig,
  model: string,
  messages: { role: string; content: string; tool_call_id?: string; tool_calls?: any[] }[],
  callbacks: StreamCallbacks,
  options?: StreamOptions,
  tools?: ToolDefinition[]
) {
  options?.signal?.throwIfAborted?.();
  const body: any = {
    model,
    messages,
    stream: true,
    temperature: options?.temperature ?? 0.7,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    console.log('[MCP-Ollama] Sending tools:', tools.map(t=>t.function.name));
  }

  const response = await fetch(`${provider.baseUrl.replace(/\/+$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    if (errText.toLowerCase().includes("tool") && tools && tools.length > 0) {
      console.warn(`[MCP-Ollama] ${provider.name} не принял tools, ретрай без них:`, errText.slice(0,200));
      return streamOllama(provider, model, messages, callbacks, options, undefined);
    }
    throw new Error(`Ollama error ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  const toolCalls: Map<number, ToolCallAccumulator> = new Map();
  let doneStreaming = false;

  while (true) {
    const { done, value } = await reader.read();
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        const content = parsed.message?.content ?? "";
        if (content) {
          fullText += content;
          callbacks.onToken(content);
        }
        // Ollama tool_calls are in message.tool_calls
        if (parsed.message?.tool_calls) {
          for (let i = 0; i < parsed.message.tool_calls.length; i++) {
            const tc = parsed.message.tool_calls[i];
            let acc = toolCalls.get(i);
            if (!acc) {
              acc = { index: i, id: tc.id || `call_${i}`, type: "function", function: { name: "", arguments: "" } };
              toolCalls.set(i, acc);
            }
            if (tc.function?.name) acc.function.name = tc.function.name;
            // Ollama may send arguments as object
            if (tc.function?.arguments) {
              if (typeof tc.function.arguments === 'string') acc.function.arguments = tc.function.arguments;
              else acc.function.arguments = JSON.stringify(tc.function.arguments);
            }
          }
        }
        if (parsed.done) {
          doneStreaming = true;
          // Real counts: prompt_eval_count = prompt tokens, eval_count = completion.
          if (callbacks.onUsage && (parsed.prompt_eval_count || parsed.eval_count)) {
            const prompt = Number(parsed.prompt_eval_count) || 0;
            const completion = Number(parsed.eval_count) || 0;
            callbacks.onUsage({
              prompt_tokens: prompt,
              completion_tokens: completion,
              total_tokens: prompt + completion,
            });
          }
          break;
        }
      } catch {}
    }
    if (doneStreaming) break;
  }

  if (toolCalls.size > 0) {
    toolRound++;
    if (toolRound > MAX_TOOL_ROUNDS) {
      fullText += (fullText ? "\n\n" : "") + `[Tool limit reached (${MAX_TOOL_ROUNDS} rounds) — answering with collected results.]`;
    } else {
    console.log('[MCP-Ollama] Received tool_calls:', toolCalls.size);
    const assistantMsg: any = { role: "assistant", content: fullText || "", tool_calls: [] };
    for (const [, tc] of toolCalls) {
      assistantMsg.tool_calls.push({
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments },
      });
    }
    messages.push(assistantMsg);
    for (const [, tc] of toolCalls) {
      let parsedArgs: Record<string, any> = {};
      try { parsedArgs = JSON.parse(tc.function.arguments); } catch {}
      console.log('[MCP] Executing ollama tool:', tc.function.name, parsedArgs);
      callbacks.onToken(`\n\n<!--TOOL_CALL:${tc.function.name}:${encodeURIComponent(JSON.stringify(parsedArgs))}-->\n\n`);
      const toolInput: MCPFileInput = { ...(parsedArgs as MCPFileInput), projectPath: options?.projectPath };
      const result = await executeMCPStep(tc.function.name, toolInput);      const resultText = result.success ? result.output.slice(0, 3000) : `Error: ${result.error}`;
      callbacks.onToken(`<!--TOOL_RESULT:${result.success}:${encodeURIComponent(resultText)}-->\n\n`);
      messages.push({ role: "tool", content: resultText, tool_call_id: tc.id });
    }

    console.log('[MCP-Ollama] Continuing stream after tool execution...');
    const continued = await streamOllama(provider, model, messages, callbacks, options, tools);
    if (continued) fullText += (fullText ? "\n\n" : "") + continued;
    else if (!fullText) {
      const names = [...toolCalls.values()].map((t) => t.function.name).filter(Boolean).join(", ");
      fullText = names ? `Tools executed: ${names}.` : "Tools executed successfully.";
    }
    } // else: tool rounds remaining
  }

  return fullText;
}

// ── OpenCode Zen routing ─────────────────────────────────────────────────
// OpenCode Zen uses different endpoints based on model type:
// - gpt-*, grok-*, muse-* → /v1/responses (OpenAI Responses API)
// - claude-*, qwen*       → /v1/messages  (Anthropic Messages API)
// - deepseek-*, glm-*, kimi-*, minimax-*, big-pickle, etc → /v1/chat/completions
function isOpenCodeZen(model: string): boolean {
  return /^(gpt-|grok-|muse-|claude-|qwen|deepseek-|glm-|kimi-|minimax-|big-pickle|mimo-|hy3-|ling-|nemotron-)/.test(model);
}

function getOpenCodeZenEndpoint(model: string): "responses" | "anthropic" | "completions" {
  if (/^(gpt-|grok-|muse-)/.test(model)) return "responses";
  if (/^(claude-|qwen)/.test(model)) return "anthropic";
  return "completions";
}

// ── OpenAI Responses API streamer (for OpenCode Zen GPT/Grok models) ──────
async function streamResponsesAPI(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  callbacks: StreamCallbacks,
  options?: StreamOptions,
) {
  options?.signal?.throwIfAborted?.();
  const input = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const body: Record<string, any> = {
    model,
    input,
    stream: true,
  };
  if (options?.temperature !== undefined) body.temperature = options.temperature;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const url = `${baseUrl.replace(/\/+$/, "")}/responses`;
  console.log(`[OpenCode Zen] Responses API → ${url} model=${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenCode Zen Responses API error ${response.status}: ${errText.slice(0, 500)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        // Responses API event types: response.output_text.delta, response.completed, etc.
        if (parsed.type === "response.output_text.delta" && parsed.delta) {
          fullText += parsed.delta;
          callbacks.onToken(parsed.delta);
        } else if (parsed.type === "response.completed" && parsed.response?.usage && callbacks.onUsage) {
          const u = parsed.response.usage;
          const prompt = Number(u.input_tokens ?? u.prompt_tokens) || 0;
          const completion = Number(u.output_tokens ?? u.completion_tokens) || 0;
          callbacks.onUsage({
            prompt_tokens: prompt,
            completion_tokens: completion,
            total_tokens: Number(u.total_tokens) || prompt + completion,
          });
        } else if (parsed.delta?.content && Array.isArray(parsed.delta.content)) {
          // Some variants
          for (const block of parsed.delta.content) {
            if (block.type === "output_text" && block.text) {
              fullText += block.text;
              callbacks.onToken(block.text);
            }
          }
        }
      } catch {}
    }
  }

  return fullText;
}

export async function sendMessageStream(
  providerId: string,
  model: string,
  messages: Message[],
  callbacks: StreamCallbacks,
  options?: StreamOptions,
  tools?: ToolDefinition[]
) {
  const provider = providerService.getProvider(providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found`);

  // One live generation: abort any previous stream, then own the slot.
  try { activeStreamAbort?.abort(); } catch {}
  const ctrl = new AbortController();
  activeStreamAbort = ctrl;
  const opts: StreamOptions = { ...options, signal: ctrl.signal };
  toolRound = 0;

  try {
    // ── OpenCode Zen: route based on model type ───────────────────────────
    if (provider.id === "opencodezen") {
      if (!provider.apiKey) throw new Error(`API key not configured for ${provider.name}. Get one at https://opencode.ai/zen`);
      const endpoint = getOpenCodeZenEndpoint(model);
      const apiMessages = buildOpenAIMessages(messages, opts?.systemPrompt);

      if (endpoint === "responses") {
        // GPT / Grok / Muse → Responses API
        // Responses API currently has NO tool-calling support in ZeqouXChat. If MCP/tools are enabled,
        // transparently fallback to chat/completions so Tool Calls always appear deterministically.
        if (tools && tools.length > 0) {
          console.warn(`[OpenCode Zen] Model ${model} normally uses Responses API, but MCP tools are ON → falling back to /v1/chat/completions to guarantee ToolCall display`);
          try {
            return await streamOpenAI(provider, model, apiMessages, callbacks, opts, tools);
          } catch (e: any) {
            console.warn("[OpenCode Zen] chat/completions fallback failed, retrying Responses API without tools:", e?.message);
            return await streamResponsesAPI(provider.baseUrl, provider.apiKey, model, apiMessages, callbacks, opts);
          }
        }
        return await streamResponsesAPI(provider.baseUrl, provider.apiKey, model, apiMessages, callbacks, opts);
      }
      if (endpoint === "anthropic") {
        // Claude / Qwen → Anthropic Messages API via OpenCode Zen
        const anthropicProvider: ProviderConfig = { ...provider, type: "anthropic" };
        const richMessages: any[] = [];
        for (const m of messages) {
          if (m.role === "system") continue;
          if ((m as any).tool_calls) {
            richMessages.push({ role: "assistant", content: m.content, tool_calls: (m as any).tool_calls });
          } else if (m.role === "tool") {
            richMessages.push({ role: "tool", content: m.content, tool_call_id: m.toolCallId });
          } else {
            richMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content, attachments: (m as any).attachments });
          }
        }
        return await streamAnthropic(anthropicProvider, model, richMessages as any, callbacks, opts, tools);
      }
      // DeepSeek / GLM / Kimi / MiniMax / Free → standard chat/completions
      return await streamOpenAI(provider, model, apiMessages, callbacks, opts, tools);
    }

    // ── Standard routing ───────────────────────────────────────────────────
    if (provider.type === "anthropic") {
      if (!provider.apiKey) throw new Error(`API key not configured for ${provider.name}`);
      const apiMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          const base: any = { role: m.role === "assistant" ? "assistant" : "user", attachments: (m as any).attachments };
          if (m.role === "tool") {
            base.role = "user";
            base.content = `[Tool ${m.toolCallId} result]: ${m.content}`;
          } else {
            base.content = m.content;
          }
          return base;
        });
      const richMessages: any[] = [];
      for (const m of messages) {
        if (m.role === "system") continue;
        if ((m as any).tool_calls) {
          richMessages.push({ role: "assistant", content: m.content, tool_calls: (m as any).tool_calls, tool_call_id: (m as any).toolCallId });
        } else if (m.role === "tool") {
          richMessages.push({ role: "tool", content: m.content, tool_call_id: m.toolCallId });
        } else {
          richMessages.push({ role: m.role, content: m.content, attachments: (m as any).attachments });
        }
      }
      const finalMessages = richMessages.length > 0 && tools ? richMessages : apiMessages;
      return await streamAnthropic(provider, model, finalMessages as any, callbacks, opts, tools);
    }
    if (provider.type === "ollama") {
      // Ollama /api/chat wants { content: string, images?: [] } — not OpenAI parts.
      const apiMessages = toOllamaMessages(buildOpenAIMessages(messages, opts?.systemPrompt));
      return await streamOllama(provider, model, apiMessages, callbacks, opts, tools);
    }
    const apiMessages = buildOpenAIMessages(messages, opts?.systemPrompt);
    return await streamOpenAI(provider, model, apiMessages, callbacks, opts, tools);
  } catch (err: any) {
    if (activeStreamAbort === ctrl) activeStreamAbort = null;
    // Aborted by user — not an error, stay silent so no fake error bubble appears.
    if (ctrl.signal.aborted || err?.name === "AbortError") throw err;
    callbacks.onError(err.message ?? "Unknown error");
    throw err;
  }
  if (activeStreamAbort === ctrl) activeStreamAbort = null;
}
