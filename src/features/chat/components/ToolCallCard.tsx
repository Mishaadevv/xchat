import { useState } from "react";
import { ChevronDown, CheckCircle, AlertCircle, Wrench, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ToolCallCardProps {
  name: string;
  args?: Record<string, unknown>;
  result?: { success: boolean; output: string };
  isRunning?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  "read-file": "Read File",
  "write-file": "Write File",
  "list-dir": "List Directory",
  "web-search": "Web Search",
  "fetch-url": "Fetch URL",
  "run-code": "Run Code",
  "terminal": "Terminal",
  "train-model": "Train Model",
  "list-tools": "List Tools",
  "delete-file": "Delete File",
  "create-directory": "Create Directory",
  "copy-file": "Copy File",
  "move-file": "Move File",
  "file-stat": "File Info",
  "search-files": "Search Files",
  "git-status": "Git Status",
  "git-diff": "Git Diff",
  "git-log": "Git Log",
  "git-commit": "Git Commit",
  "system-info": "System Info",
  "open-in-explorer": "Open in Explorer",
  "run-python": "Run Python",
  "format-code": "Format Code",
  "summarize-file": "Summarize File",
  "add-memory": "Add Memory",
  "list-memory": "List Memory",
  "search-memory": "Search Memory",
  "update-memory": "Update Memory",
  "remove-memory": "Remove Memory",
  "clear-memory": "Clear Memory",
};

export function ToolCallCard({ name, args, result, isRunning }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[name] || name;

  // Extract a short summary from args
  const argSummary = args
    ? Object.entries(args)
        .filter(([k]) => !["projectPath"].includes(k))
        .slice(0, 2)
        .map(([k, v]) => {
          const val = typeof v === "string" ? v : JSON.stringify(v);
          return val.length > 40 ? val.slice(0, 40) + "…" : val;
        })
        .join(", ")
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="my-2 mx-6"
    >
      <div
        className={cn(
          "border rounded-xl overflow-hidden transition-all",
          result
            ? result.success
              ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20"
              : "border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900",
          isRunning && "animate-pulse"
        )}
      >
        {/* Header — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin shrink-0" />
          ) : result ? (
            result.success ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            )
          ) : (
            <Wrench className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          )}

          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {label}
          </span>

          {argSummary && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[260px]">
              {argSummary}
            </span>
          )}

          <span className="ml-auto flex items-center gap-1.5">
            {result && (
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                  result.success
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                )}
              >
                {result.success ? "OK" : "Error"}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-zinc-400 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </span>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="border-t border-zinc-100 dark:border-zinc-800 overflow-hidden"
            >
              {args && Object.keys(args).length > 0 && (
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                    Input
                  </p>
                  <pre className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono whitespace-pre-wrap break-words bg-white dark:bg-zinc-950 rounded-lg p-2.5 border border-zinc-100 dark:border-zinc-800 max-h-32 overflow-y-auto">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
              {result && (
                <div className={cn("px-3.5 py-2.5", args && Object.keys(args).length > 0 && "border-t border-zinc-100 dark:border-zinc-800")}>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                    Output
                  </p>
                  <pre
                    className={cn(
                      "text-[11px] font-mono whitespace-pre-wrap break-words rounded-lg p-2.5 max-h-40 overflow-y-auto",
                      result.success
                        ? "text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800"
                        : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900"
                    )}
                  >
                    {result.output || "(empty)"}
                  </pre>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
