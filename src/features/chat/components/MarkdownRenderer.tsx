import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, ChevronDown, ChevronUp, Maximize2, WrapText } from "lucide-react";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { openUrl } from "@/lib/platform";

// ── Inline code ───────────────────────────────────────────────────────────────
function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-md px-1.5 py-0.5 text-[13px] font-mono border border-zinc-200/50 dark:border-zinc-700/50 break-words">
      {children}
    </code>
  );
}

// ── Code block with copy, collapse, wrap, fullscreen ────────────────────────
function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const lines = children.split("\n");
  const isLong = lines.length > 30 || children.length > 2500;
  const [expanded, setExpanded] = useState(!isLong);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = children;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayCode = expanded ? children : lines.slice(0, 30).join("\n");

  return (
    <>
      <div className="my-3 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.25)] group/code">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="text-[11px] text-zinc-500 font-mono ml-1 tracking-wide uppercase">
              {language || "text"}
            </span>
            <span className="text-[11px] text-zinc-600 font-mono hidden sm:inline">
              • {lines.length} lines • {children.length} chars
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWrap(!wrap)}
              title={wrap ? "No wrap" : "Wrap"}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
            >
              <WrapText className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setFullscreen(true)}
              title="Fullscreen"
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors hidden sm:flex"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors px-2.5 py-1 rounded-md hover:bg-zinc-800 border border-transparent hover:border-zinc-700"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>
        {/* Code */}
        <div className={cn("relative", !expanded && "max-h-[480px]")}>
          <div className="p-3.5 overflow-x-auto scrollbar-thin">
            <pre
              className={cn(
                "text-[13px] leading-relaxed text-zinc-100 font-mono",
                wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                "selection:bg-violet-500/30"
              )}
            >
              <code className={language ? `language-${language}` : ""}>{displayCode}</code>
            </pre>
          </div>
          {!expanded && (
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
          )}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border-t border-zinc-800 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Свернуть
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> Показать полностью ({lines.length} строк)
              </>
            )}
          </button>
        )}
      </div>
      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
            <span className="text-sm font-mono text-zinc-400">{language || "code"} • {lines.length} lines</span>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy} className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-white text-zinc-900 text-xs font-medium hover:bg-zinc-100">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={() => setFullscreen(false)} className="h-8 px-3 rounded-lg bg-zinc-800 text-white text-xs">Close</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <pre className={cn("text-[13px] leading-relaxed text-zinc-100 font-mono", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>
              {children}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

// ── Collapsible wrapper for long markdown ────────────────────────────────────
function CollapsibleMarkdown({ children, content }: { children: React.ReactNode; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = content.length > 4000 || content.split("\n").length > 80;
  const [measured, setMeasured] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // quick heuristic without DOM measurement
  const needsCollapse = shouldCollapse && !expanded;

  if (!shouldCollapse) return <>{children}</>;

  return (
    <div className="relative">
      <div className={cn(!expanded && "max-h-[600px] overflow-hidden")}>
        {children}
        {!expanded && (
          <div className="absolute inset-x-0 bottom-12 h-24 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" /> Свернуть
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" /> Показать полностью ({Math.ceil(content.length / 1000)}k символов)
          </>
        )}
      </button>
    </div>
  );
}

// ── Table with adaptive styling ─────────────────────────────────────────────
function TableWrapper({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const handleCopyTable = () => {
    // find table text
    const el = document.activeElement;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm border-collapse min-w-[500px]">{children}</table>
      </div>
      <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
        <span>↔ Scroll to see all columns • ↕ Scroll rows</span>
      </div>
    </div>
  );
}

// ── Image with preview ───────────────────────────────────────────────────────
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  if (!src) return null;
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs border border-red-200 dark:border-red-900">
        ⚠ Image failed: {alt || src.slice(0, 40)}
      </span>
    );
  }
  return (
    <>
      <span className="block my-3">
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          onClick={() => setLightbox(true)}
          className="max-w-full h-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-zoom-in hover:shadow-md transition-shadow max-h-[520px] object-contain bg-zinc-50 dark:bg-zinc-900"
          loading="lazy"
        />
        {alt && <span className="block text-[11px] text-zinc-500 mt-1 text-center italic">{alt}</span>}
      </span>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={src} alt={alt} className="max-w-[92vw] max-h-[92vh] rounded-xl shadow-2xl" />
        </div>
      )}
    </>
  );
}

// ── Blockquote with copy ─────────────────────────────────────────────────────
function Blockquote({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  // extract text for copy - simplified
  const handleCopy = async () => {
    const text = (children as any)?.toString?.() || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <blockquote className="border-l-[3px] border-violet-400 pl-4 py-2.5 my-3 text-zinc-600 dark:text-zinc-400 bg-violet-50/60 dark:bg-violet-950/20 rounded-r-xl text-[14px] leading-relaxed relative group/quote">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 opacity-0 group-hover/quote:opacity-100 transition-opacity hover:bg-zinc-50"
        title="Copy quote"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
      </button>
      {children}
    </blockquote>
  );
}

// ── Main renderer ────────────────────────────────────────────────────────────
export function MarkdownRenderer({ content, enableCollapsible = true }: { content: string; enableCollapsible?: boolean }) {
  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, [rehypeHighlight, { ignoreMissing: true }]]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const inline = !match && !className;
          const codeStr = String(children).replace(/\n$/, "");
          // rehype-highlight adds class to <code>, but we intercept block code
          // If parent is <pre>, react-markdown calls code with className; we render CodeBlock.
          // Inline code has no language and is not inside pre (we check via props)
          // Heuristic: if codeStr contains \n or has language, treat as block
          const isBlock = !!match || codeStr.includes("\n") || (className && className.includes("language-"));
          if (inline && !isBlock) return <InlineCode>{children}</InlineCode>;
          // If inside pre, react-markdown will wrap with <pre> via our pre override; avoid double wrapper
          // We handle block here directly
          return <CodeBlock language={match?.[1]}>{codeStr}</CodeBlock>;
        },
        pre({ children }) {
          // When code is block, CodeBlock already includes pre; avoid extra wrapper
          // Detect if children is our CodeBlock (it renders div). So just return children.
          // If it's plain text without language, fallback
          return <>{children}</>;
        },
        p({ children }) {
          return <p className="mb-2.5 last:mb-0 leading-[1.7] text-[14.5px] text-zinc-700 dark:text-zinc-300 break-words">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-3 space-y-1.5 text-[14.5px] text-zinc-700 dark:text-zinc-300 marker:text-zinc-400">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-[14.5px] text-zinc-700 dark:text-zinc-300 marker:text-zinc-400">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-[1.7] marker:font-medium">{children}</li>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href) openUrl(href);
              }}
              className="text-violet-600 dark:text-violet-400 underline decoration-violet-300/50 hover:decoration-violet-500 underline-offset-2 font-medium cursor-pointer hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              {children}
            </a>
          );
        },
        h1({ children }) {
          return <h1 className="text-[22px] font-bold mt-6 mb-3 text-zinc-900 dark:text-white tracking-tight border-b border-zinc-100 dark:border-zinc-800 pb-2">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-[18px] font-bold mt-5 mb-2.5 text-zinc-900 dark:text-white tracking-tight">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-[16px] font-semibold mt-4 mb-2 text-zinc-900 dark:text-white">{children}</h3>;
        },
        h4({ children }) {
          return <h4 className="text-[15px] font-semibold mt-3 mb-1.5 text-zinc-800 dark:text-zinc-200">{children}</h4>;
        },
        blockquote({ children }) {
          return <Blockquote>{children}</Blockquote>;
        },
        table({ children }) {
          return <TableWrapper>{children}</TableWrapper>;
        },
        thead({ children }) {
          return <thead className="bg-zinc-50 dark:bg-zinc-800/80 sticky top-0 z-10">{children}</thead>;
        },
        th({ children }) {
          return <th className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 whitespace-nowrap bg-zinc-50 dark:bg-zinc-800">{children}</th>;
        },
        td({ children }) {
          return <td className="border-b border-zinc-100 dark:border-zinc-800/50 px-3 py-2 text-[13px] text-zinc-700 dark:text-zinc-300 align-top">{children}</td>;
        },
        tr({ children }) {
          return <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">{children}</tr>;
        },
        strong({ children }) {
          return <strong className="font-semibold text-zinc-900 dark:text-white">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-zinc-700 dark:text-zinc-300">{children}</em>;
        },
        hr() {
          return <hr className="my-6 border-zinc-200 dark:border-zinc-800" />;
        },
        img({ src, alt }) {
          return <MarkdownImage src={src} alt={alt} />;
        },
        del({ children }) {
          return <del className="line-through text-zinc-500">{children}</del>;
        },
        input(props: any) {
          // task list checkbox
          return <input {...props} className="mr-1.5 accent-violet-600" disabled />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  if (enableCollapsible) {
    return <CollapsibleMarkdown content={content}>{markdown}</CollapsibleMarkdown>;
  }
  return markdown;
}

// ── Attachment renderer ──────────────────────────────────────────────────────
export function AttachmentPreview({ attachments }: { attachments: { id: string; name: string; type: string; size?: number; url?: string }[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att) => {
        const isImage = att.type === "image" || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name);
        return (
          <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
            {isImage && att.url ? (
              <img src={att.url} alt={att.name} className="w-10 h-10 rounded-lg object-cover border" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border flex items-center justify-center text-[10px] font-mono text-zinc-500">
                {att.name.split(".").pop()?.toUpperCase().slice(0, 3) || "FILE"}
              </div>
            )}
            <div className="flex flex-col min-w-0 max-w-[160px]">
              <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{att.name}</span>
              <span className="text-[11px] text-zinc-500">{att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
