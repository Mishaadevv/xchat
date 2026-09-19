import { useState } from "react";
import { User, Bot, Copy, Check, RefreshCw, Pencil, X, Save, FileText, Image as ImageIcon } from "lucide-react";
import { type Message } from "@/core/types";
import { cn } from "@/lib/utils";
import { chatStore } from "../store/chatStore";
import { i18n } from "@/services/i18n";
import { useStore } from "@/lib/useStore";
import { ToolCallCard } from "./ToolCallCard";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface ChatMessageProps {
  message: Message;
}

// ── Tool marker parsing ──────────────────────────────────────────────────────
// Robust: TOOL_CALL:<name>:<urlEncodedJson>   TOOL_RESULT:<true|false>:<urlEncodedOutput>
// Legacy fallback: if result marker contains success inside data prefix, handle it too.
function parseToolMarkers(text: string): (string | { type: "call" | "result"; name: string; success?: boolean; data: string })[] {
  const parts: (string | { type: "call" | "result"; name: string; success?: boolean; data: string })[] = [];
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
      // TOOL_RESULT
      const successRaw = match[2];
      let success: boolean;
      let output = "";
      // New format: success flag is in match[2] (true/false/1/0)
      if (successRaw === "true" || successRaw === "1" || successRaw === "false" || successRaw === "0") {
        success = successRaw === "true" || successRaw === "1";
        try { output = decodeURIComponent(match[3]); } catch { output = match[3]; }
      } else {
        // Legacy: success flag was inside encoded data prefix (e.g. TOOL_RESULT::trueOUTPUT)
        let raw = "";
        try { raw = decodeURIComponent(match[3]); } catch { raw = match[3]; }
        // Also consider case where successRaw is empty and raw starts with true/false
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

// ── Markdown content with tool cards ─────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const parts = parseToolMarkers(content);
  const rendered: React.JSX.Element[] = [];
  let i = 0;
  let callIdx = 0;

  while (i < parts.length) {
    const part = parts[i];
    if (typeof part === "string") {
      const trimmed = part.trim();
      if (trimmed) {
        rendered.push(
          <div key={`md-${i}`} className="animate-in fade-in duration-300">
            <MarkdownRenderer content={trimmed} />
          </div>
        );
      }
      i++;
    } else if (part.type === "call") {
      let result: { success: boolean; output: string } | undefined;
      if (i + 1 < parts.length && typeof parts[i + 1] !== "string" && (parts[i + 1] as any).type === "result") {
        const r = parts[i + 1] as any;
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

// ── Main message component ───────────────────────────────────────────────────

export function ChatMessage({ message }: ChatMessageProps) {
  const _locale = useStore(i18n.subscribe, i18n.getLocale);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // Clipboard API blocked (permissions / insecure context) — legacy fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = message.content;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.content) {
      chatStore.updateMessage(message.id, editText.trim());
    }
    setEditing(false);
  };

  const handleRegenerate = () => {
    chatStore.regenerateLast();
  };

  return (
    <div className={cn("group", isUser ? "flex justify-end" : "flex justify-start")}>
      <div className={cn("flex gap-2.5 px-4 sm:px-6 py-2", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        {isUser ? (
          <div className="w-7 h-7 rounded-full bg-zinc-800 dark:bg-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
            <User className="h-3.5 w-3.5 text-white dark:text-zinc-800" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </div>
        )}

        {/* Content */}
        <div className={cn("flex flex-col max-w-[700px] min-w-0", isUser ? "items-end" : "items-start")}>
          {/* Bubble */}
          <div className={cn(
            "px-4 py-3 text-[14.5px] leading-[1.7] shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
            isUser
              ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded-2xl rounded-tr-md"
              : "bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl rounded-tl-md"
          )}>
            {isUser ? (
              editing ? (
                <div className="min-w-[200px]">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-transparent text-white dark:text-zinc-900 text-[14.5px] leading-[1.7] outline-none resize-none min-h-[60px] font-[450]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                      if (e.key === "Escape") setEditing(false);
                    }}
                  />
                  <div className="flex gap-1.5 mt-2 justify-end">
                    <button onClick={() => setEditing(false)} className="h-7 px-3 flex items-center gap-1 rounded-lg bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-600 dark:hover:bg-zinc-400 transition-colors">
                      <X className="h-3 w-3" /> Cancel
                    </button>
                    <button onClick={handleSaveEdit} className="h-7 px-3 flex items-center gap-1 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors">
                      <Save className="h-3 w-3" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap font-[450] break-words">{message.content}</p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {message.attachments.map((att) => {
                        const isImg = att.type === "image" || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name);
                        return (
                          <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/10 dark:bg-zinc-700/50 border border-white/20 dark:border-zinc-600 text-xs backdrop-blur">
                            {isImg && att.url ? (
                              <img src={att.url} alt={att.name} className="w-8 h-8 rounded-lg object-cover" />
                            ) : att.type === "image" ? <ImageIcon className="h-3.5 w-3.5 opacity-70" /> : <FileText className="h-3.5 w-3.5 opacity-70" />}
                            <span className="max-w-[140px] truncate">{att.name}</span>
                            {att.size && <span className="text-[10px] opacity-60">{(att.size/1024).toFixed(1)}KB</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-2 w-full">
                <MarkdownContent content={message.content} />
                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {message.attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border text-xs">
                        <FileText className="h-3 w-3" /> <span className="truncate max-w-[160px]">{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action bar — on hover */}
          <div className={cn(
            "flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
            isUser ? "flex-row-reverse" : "flex-row"
          )}>
            {/* Timestamp */}
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono px-1">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>

            {/* Copy */}
            <button onClick={handleCopy} className="h-6 px-2 flex items-center gap-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title="Copy">
              {copied ? <Check className="h-3 text-emerald-500" /> : <Copy className="h-3" />}
            </button>

            {/* Edit (user only) */}
            {isUser && !editing && (
              <button onClick={() => { setEditing(true); setEditText(message.content); }} className="h-6 px-2 flex items-center gap-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title="Edit">
                <Pencil className="h-3" />
              </button>
            )}

            {/* Regenerate (assistant only) */}
            {!isUser && (
              <button onClick={handleRegenerate} className="h-6 px-2 flex items-center gap-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title="Regenerate">
                <RefreshCw className="h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
