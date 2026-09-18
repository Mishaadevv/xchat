import { useState, useEffect, useRef, useMemo } from "react";
import { Bot, ArrowDown } from "lucide-react";
import { useStore } from "@/lib/useStore";
import { chatStore } from "../store/chatStore";
import { ChatMessage } from "./ChatMessage";
import { ToolCallCard } from "./ToolCallCard";
import { i18n } from "@/services/i18n";
import { getModelContextUsage } from "@/services/contextWindow";
import { MarkdownRenderer } from "./MarkdownRenderer";

/** Pad incomplete markdown so it renders nicely during streaming. */
function padIncompleteMarkdown(raw: string): string {
  let text = raw;
  const fenceRegex = /^(?:`{3,}|~{3,})/gm;
  let fenceCount = 0;
  while (fenceRegex.exec(text)) fenceCount++;
  if (fenceCount % 2 !== 0) {
    const lastFence = text.match(/(?:`{3,}|~{3,})\s*(\w*)\s*$/m);
    const lang = lastFence?.[1] || "";
    text += "\n" + (lang ? "```" : "```") + "\n";
  }
  const boldMarkers = (text.match(/\*\*/g) || []).length;
  if (boldMarkers % 2 !== 0) text += "**";
  const singleStars = text.replace(/\*\*/g, "").split("*").length - 1;
  if (singleStars % 2 !== 0) text += "*";
  const boldUnderscores = (text.match(/__/g) || []).length;
  if (boldUnderscores % 2 !== 0) text += "__";
  return text;
}

// ── Tool marker parsing ──────────────────────────────────────────────────────

interface ToolMarker {
  type: "call" | "result";
  name: string;
  success?: boolean;
  data: string;
}

function parseToolMarkers(text: string): (string | ToolMarker)[] {
  const parts: (string | ToolMarker)[] = [];
  const regex = /<!--(TOOL_CALL|TOOL_RESULT):([^:]*):([^>]*)-->/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const rawType = match[1];
    if (rawType === "TOOL_CALL") {
      const name = match[2];
      let data = "";
      try { data = decodeURIComponent(match[3]); } catch { data = match[3]; }
      parts.push({ type: "call", name, data });
    } else {
      const successRaw = match[2];
      let success: boolean;
      let output = "";
      if (successRaw === "true" || successRaw === "1" || successRaw === "false" || successRaw === "0") {
        success = successRaw === "true" || successRaw === "1";
        try { output = decodeURIComponent(match[3]); } catch { output = match[3]; }
      } else {
        // legacy fallback: success flag inside data
        let raw = "";
        try { raw = decodeURIComponent(match[3]); } catch { raw = match[3]; }
        const combined = successRaw ? `${successRaw}:${raw}` : raw;
        success = combined.startsWith("true") || combined.startsWith("1");
        output = combined.replace(/^(true|false|1|0):?/, "");
        try { output = decodeURIComponent(output); } catch {}
      }
      parts.push({ type: "result", name: "", success, data: output });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// ── Text-based tool detection (fallback when function calling doesn't work) ──

interface DetectedTool {
  name: string;
  args: Record<string, string>;
}

const TOOL_PATTERNS: { pattern: RegExp; toolName: string; argKey: string }[] = [
  // read-file / reading file
  { pattern: /(?:read(?:ing)?[\s-]*(?:file|файл)[\s:]*(?:`([^`]+)`|"([^"]+)"|'([^']+)'|([\w./\\-]+\.\w+)))/gi, toolName: "read-file", argKey: "path" },
  { pattern: /(?:readFile|read_file)\s*\(\s*["']([^"']+)["']/gi, toolName: "read-file", argKey: "path" },
  // list-dir / listing directory
  { pattern: /(?:list(?:ing)?[\s-]*(?:dir|directory|папку|директорию)[\s:]*(?:`([^`]+)`|"([^"]+)"|'([^']+)'|([\w./\\-]+)))/gi, toolName: "list-dir", argKey: "path" },
  { pattern: /(?:listDir|list_dir)\s*\(\s*["']([^"']+)["']/gi, toolName: "list-dir", argKey: "path" },
  // write-file / writing file
  { pattern: /(?:writ(?:e|ing)[\s-]*(?:to[\s-]*)?(?:file|файл)[\s:]*(?:`([^`]+)`|"([^"]+)"|'([^']+)'|([\w./\\-]+\.\w+)))/gi, toolName: "write-file", argKey: "path" },
  // web-search / searching
  { pattern: /(?:search(?:ing)?[\s-]*(?:for|по|в[\s-]*(?:интернет|web|google|internet))[\s:]*(?:`([^`]+)`|"([^"]+)"|'([^']+)'))/gi, toolName: "web-search", argKey: "query" },
  // run-code / executing code
  { pattern: /(?:execut(?:e|ing)|running|запуска[ею]|выполня[ею])[\s:]*(?:code|код|скрипт|script)[\s:]*(?:`([^`]+)`|"([^"]+)")/gi, toolName: "run-code", argKey: "code" },
  // terminal / shell command
  { pattern: /(?:running|выполня[ею]|запуска[ею])[\s:]*(?:shell|terminal|команду|command)[\s:]*(?:`([^`]+)`|"([^"]+)"|'([^']+)')/gi, toolName: "terminal", argKey: "command" },
  { pattern: /(?:terminal|shell)[\s:]+`([^`]+)`/gi, toolName: "terminal", argKey: "command" },
  // git operations
  { pattern: /(?:git[\s-]*(?:status|diff|log|commit))/gi, toolName: "git-status", argKey: "path" },
];

function detectToolsInText(text: string): { cleanText: string; tools: DetectedTool[] } {
  const tools: DetectedTool[] = [];
  let cleanText = text;

  for (const { pattern, toolName, argKey } of TOOL_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const value = m[1] || m[2] || m[3] || m[4] || "";
      if (value) {
        tools.push({ name: toolName, args: { [argKey]: value } });
      }
    }
  }

  return { cleanText, tools };
}

// ── Streaming content with tool card rendering ───────────────────────────────

function StreamingContent({ content }: { content: string }) {
  const parts = parseToolMarkers(content);
  const rendered: React.JSX.Element[] = [];
  let i = 0;
  let callIdx = 0;

  while (i < parts.length) {
    const part = parts[i];
    if (typeof part === "string") {
      const trimmed = part.trim();
      if (trimmed) {
        // Check for text-based tool patterns
        const { tools: detectedTools } = detectToolsInText(trimmed);
        const padded = padIncompleteMarkdown(trimmed);

        // Render detected tool cards
        for (const dt of detectedTools) {
          rendered.push(
            <ToolCallCard
              key={`detected-${callIdx++}`}
              name={dt.name}
              args={dt.args}
              isRunning={true}
            />
          );
        }

        rendered.push(
          <div key={`text-${i}`} className="px-4 sm:px-6 py-3 animate-in fade-in">
            <div className="flex gap-3 max-w-[780px] mx-auto">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <MarkdownRenderer content={padded} enableCollapsible={false} />
                {i === parts.length - 1 && (
                  <span className="inline-block w-1.5 h-3.5 bg-violet-500 ml-0.5 animate-pulse rounded-full align-middle" />
                )}
              </div>
            </div>
          </div>
        );
      }
      i++;
    } else if (part.type === "call") {
      let result: { success: boolean; output: string } | undefined;
      if (i + 1 < parts.length && typeof parts[i + 1] !== "string" && (parts[i + 1] as ToolMarker).type === "result") {
        const r = parts[i + 1] as ToolMarker;
        result = { success: r.success ?? true, output: r.data };
        i += 2;
      } else {
        result = undefined;
        i++;
      }
      rendered.push(
        <ToolCallCard
          key={`tool-${callIdx++}`}
          name={part.name}
          args={(() => { try { return JSON.parse(part.data); } catch { return {}; } })()}
          result={result}
          isRunning={!result}
        />
      );
    } else {
      i++;
    }
  }
  return <>{rendered}</>;
}

// ── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="px-4 sm:px-6 py-3">
      <div className="flex gap-3 max-w-[780px] mx-auto">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-zinc-400">{i18n.t("chat.thinking_dots")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Markdown wrappers using new renderer ────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  return <MarkdownRenderer content={content} />;
}
function MarkdownText({ content }: { content: string }) {
  return <MarkdownRenderer content={content} enableCollapsible={false} />;
}

// ── Main component ───────────────────────────────────────────────────────────

export function ChatMessages() {
  const _locale = useStore(i18n.subscribe, i18n.getLocale);
  const { messages, isStreaming, streamingContent, errorMessage, model } = useStore(
    chatStore.subscribe,
    chatStore.getState
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Real-time context usage (includes streaming content)
  const contextUsage = useMemo(() => {
    if (!model) return null;
    const allContent = [
      ...messages.map(m => ({ content: m.content, role: m.role })),
    ];
    if (isStreaming && streamingContent) {
      allContent.push({ content: streamingContent, role: "assistant" });
    }
    return getModelContextUsage(model, allContent);
  }, [model, messages, isStreaming, streamingContent]);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isStreaming, streamingContent]);

  // Track scroll position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 300);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  // Expose contextUsage for the header to read
  useEffect(() => {
    (window as any).__zeqoux_context = contextUsage;
    return () => { delete (window as any).__zeqoux_context; };
  }, [contextUsage]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-[860px] mx-auto w-full pb-4">
        {messages.length === 0 && !isStreaming && <div className="h-4" />}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingContent.length > 0 && (
          <StreamingContent content={streamingContent} />
        )}

        {isStreaming && streamingContent.length === 0 && !errorMessage && (
          <ThinkingIndicator />
        )}

        {errorMessage && (
          <div className="px-4 sm:px-6 py-4">
            <div className="max-w-[780px] mx-auto bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-2xl px-4 py-3">
              <p className="font-medium mb-0.5">{i18n.t("chat.error")}</p>
              <p className="text-red-600/80 dark:text-red-400/80 text-xs">{errorMessage}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 z-20 h-9 w-9 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg flex items-center justify-center hover:shadow-xl transition-all active:scale-95"
        >
          <ArrowDown className="h-4 w-4 text-zinc-500" />
        </button>
      )}
    </div>
  );
}
