import { useRef, useEffect, useState, useCallback } from "react";
import { Paperclip, Image, Globe, Brain, Blocks, Send, Square, X, Thermometer, Wrench, HelpCircle, Trash2, FileText, Search, Code2, Terminal, GitBranch, Sparkles, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/useStore";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { chatStore } from "../store/chatStore";
import { providerService } from "@/services/providers";
import { localRuntime } from "@/services/localRuntime";
import { reportSelectedContext } from "@/services/contextWindow";
import { MCPPanel } from "./MCPPanel";
import { settingsStore } from "@/services/settingsStore";
import { i18n } from "@/services/i18n";
import type { Attachment } from "@/core/types";

// ── Slash commands ────────────────────────────────────────────────────────
interface SlashCmd {
  id: string;
  name: string;
  description: string;
  icon: any;
  prompt: string;
}
function getSlashCommands(): SlashCmd[] {
  return [
    { id: "help", name: "/help", description: i18n.t("chat.cmd_help"), icon: HelpCircle, prompt: i18n.t("chat.cmd_help_prompt") },
    { id: "clear", name: "/clear", description: i18n.t("chat.cmd_clear"), icon: Trash2, prompt: "/clear" },
    { id: "new", name: "/new", description: i18n.t("chat.cmd_new"), icon: Sparkles, prompt: "/new" },
    { id: "explain", name: "/explain", description: i18n.t("chat.cmd_explain"), icon: Code2, prompt: i18n.t("chat.cmd_explain_prompt") },
    { id: "fix", name: "/fix", description: i18n.t("chat.cmd_fix"), icon: Wrench, prompt: i18n.t("chat.cmd_fix_prompt") },
    { id: "write", name: "/write", description: i18n.t("chat.cmd_write"), icon: FileText, prompt: i18n.t("chat.cmd_write_prompt") },
    { id: "read", name: "/read", description: i18n.t("chat.cmd_read"), icon: FileText, prompt: i18n.t("chat.cmd_read_prompt") },
    { id: "list", name: "/list", description: i18n.t("chat.cmd_list"), icon: Search, prompt: i18n.t("chat.cmd_list_prompt") },
    { id: "search", name: "/search", description: i18n.t("chat.cmd_search"), icon: Search, prompt: i18n.t("chat.cmd_search_prompt") },
    { id: "run", name: "/run", description: i18n.t("chat.cmd_run"), icon: Terminal, prompt: i18n.t("chat.cmd_run_prompt") },
    { id: "python", name: "/python", description: i18n.t("chat.cmd_python"), icon: Code2, prompt: "/python " },
    { id: "git", name: "/git", description: i18n.t("chat.cmd_git"), icon: GitBranch, prompt: i18n.t("chat.cmd_git_prompt") },
    { id: "translate", name: "/translate", description: i18n.t("chat.cmd_translate"), icon: Sparkles, prompt: i18n.t("chat.cmd_translate_prompt") },
    { id: "imagine", name: "/imagine", description: i18n.t("chat.cmd_imagine"), icon: Sparkles, prompt: i18n.t("chat.cmd_imagine_prompt") },
  ];
}

export function ChatInput() {
  const { inputValue, isStreaming, thinkingMode, internetMode, mcpMode, temperature, provider, model, maxContextTokens } = useStore(
    chatStore.subscribe,
    chatStore.getState
  );
  const { sendOnEnter } = useStore(settingsStore.subscribe, settingsStore.getState);
  const locale = useStore(i18n.subscribe, i18n.getLocale);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const slashCommands = getSlashCommands();
  const filteredSlash = slashCommands.filter(c => {
    if (!slashFilter) return true;
    return c.name.toLowerCase().includes(slashFilter.toLowerCase()) || c.description.toLowerCase().includes(slashFilter.toLowerCase());
  });

  useEffect(() => {
    if (inputValue.startsWith("/") && !isStreaming) {
      const filter = inputValue.slice(1).split(" ")[0].toLowerCase();
      setSlashFilter(filter);
      setShowSlash(true);
      setSlashIndex(0);
    } else {
      setShowSlash(false);
    }
  }, [inputValue, isStreaming]);

  const handleSlashSelect = (cmd: SlashCmd) => {
    if (cmd.id === "clear") {
      // clear current chat visually by sending a system message
      chatStore.setInputValue("");
      setShowSlash(false);
      return;
    }
    if (cmd.id === "new") {
      // new chat is created on next send, just clear input
      chatStore.setInputValue("");
      setShowSlash(false);
      return;
    }
    chatStore.setInputValue(cmd.prompt);
    setShowSlash(false);
    textareaRef.current?.focus();
  };

  // ── File reading helpers ──────────────────────────────────────────────────
  const TEXT_EXTS = new Set(["txt","md","markdown","json","jsonl","csv","log","html","htm","css","js","ts","tsx","jsx","py","java","c","cpp","h","hpp","cs","go","rs","php","rb","swift","kt","sh","bash","zsh","yaml","yml","toml","ini","conf","xml","svg","sql","r"," Dart","dart","lua","pl","env","gitignore","dockerfile","makefile","config"]);
  const isTextFile = (f: File) => {
    if (f.type.startsWith("text/")) return true;
    if (["application/json","application/javascript","application/xml","application/x-sh"].includes(f.type)) return true;
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    return TEXT_EXTS.has(ext) || TEXT_EXTS.has(ext.split("?")[0]);
  };

  const readFileAsAttachment = (file: File, fallbackType: "file" | "image"): Promise<Attachment> => {
    return new Promise((resolve) => {
      const att: Attachment = { id: crypto.randomUUID(), name: file.name, type: fallbackType, size: file.size, mime: file.type };
      // Image → data URL
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          att.url = reader.result as string;
          att.type = "image";
          // Also keep small text hint for AI
          att.content = `[Image: ${file.name} ${file.type} ${(file.size/1024).toFixed(1)}KB]`;
          resolve(att);
        };
        reader.onerror = () => resolve(att);
        reader.readAsDataURL(file);
        return;
      }
      // Text → read as text (limit 50k chars)
      if (isTextFile(file) && file.size < 5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          att.content = text.slice(0, 50000);
          if (text.length > 50000) att.content += `\n\n... [truncated ${text.length - 50000} chars]`;
          att.type = "file";
          resolve(att);
        };
        reader.onerror = () => resolve(att);
        reader.readAsText(file);
        return;
      }
      // Other binary → keep placeholder
      att.content = `[Binary file: ${file.name} ${file.type || "unknown"} ${(file.size/1024).toFixed(1)}KB — content not previewable, please describe what you need]`;
      resolve(att);
    });
  };

  const addFiles = useCallback(async (files: FileList, type: "file" | "image") => {
    const arr = Array.from(files);
    const atts: Attachment[] = [];
    for (const f of arr) {
      const att = await readFileAsAttachment(f, type);
      atts.push(att);
    }
    setAttachments((prev) => [...prev, ...atts]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      addFiles(files, files[0].type.startsWith("image/") ? "image" : "file");
    }
  }, [addFiles]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files: File[] = [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      addFiles(dt.files, files[0].type.startsWith("image/") ? "image" : "file");
    }
  }, [addFiles]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, window.innerHeight * 0.4)}px`;
    }
  }, [inputValue]);

  const handleSend = () => {
    if ((!inputValue.trim() && attachments.length === 0) || isStreaming) return;
    // handle slash commands that are actions
    if (inputValue.trim() === "/clear" || inputValue.trim() === "/new") {
      chatStore.setInputValue("");
      setShowSlash(false);
      return;
    }
    // Attachments: pass along so AI can analyze documents/code/images
    const toSend = inputValue.trim() || (attachments.length ? `Attached ${attachments.length} file(s): ${attachments.map(a=>a.name).join(", ")}` : "");
    const atts = attachments.length ? [...attachments] : undefined;
    chatStore.sendMessage(toSend, atts);
    chatStore.setInputValue("");
    setAttachments([]);
    setShowSlash(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlash && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex(i => (i + 1) % filteredSlash.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex(i => (i - 1 + filteredSlash.length) % filteredSlash.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // if slash menu open, Enter selects, otherwise send
        if (inputValue.startsWith("/")) {
          e.preventDefault();
          handleSlashSelect(filteredSlash[slashIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        setShowSlash(false);
        return;
      }
    }
    if (sendOnEnter ? (e.key === "Enter" && !e.shiftKey) : (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelect = () => {
    imageInputRef.current?.click();
  };

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>, type: "file" | "image") => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const att = await readFileAsAttachment(f, type);
      setAttachments((prev) => [...prev, att]);
    }
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Local context size (only for local providers) ─────────────────────────
  const CONTEXT_OPTIONS = [4096, 8192, 16384, 32768, 131072];
  const activeProvider = providerService.getProvider(provider);
  const isLocalProvider =
    !!activeProvider && (activeProvider.type === "ollama" || activeProvider.category === "local");
  const formatCtx = (v: number) => (v >= 1000 ? `${Math.round(v / 1024)}K` : `${v}`);

  const handleCtxSelect = async (v: number) => {
    chatStore.setMaxContextTokens(v);
    // Keep the shared context indicator in sync with the picked window size;
    // the engine override takes precedence once /props answers.
    reportSelectedContext(v);
    // The built-in engine bakes -c at startup — restart it with the new size.
    const rt = localRuntime.getState();
    if ((rt.status === "running" || rt.status === "starting") && rt.modelPath) {
      if (isStreaming) chatStore.stopStreaming();
      const path = rt.modelPath;
      const gpuLayers = rt.gpuLayers;
      const displayName = rt.modelFile?.replace(/\.gguf$/i, "") || model;
      await localRuntime.stop();
      await localRuntime.start(path, { gpuLayers, ctx: v, displayName });
    }
  };

  return (
    <div
      className="shrink-0 px-4 pb-5 pt-3 bg-gradient-to-t from-background via-background to-transparent"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TooltipProvider>
        <motion.div
          layout
          className={cn(
            "max-w-[760px] mx-auto bg-white dark:bg-zinc-900 border rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-200 relative",
            dragOver
              ? "border-violet-500/50 bg-violet-50/50 dark:bg-violet-950/20 shadow-[0_8px_32px_rgba(124,58,237,0.15)]"
              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)]"
          )}
        >
          {/* Slash commands */}
          {showSlash && filteredSlash.length > 0 && (
            <div className="absolute bottom-full mb-3 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">{i18n.t("chat.slash_title")}</span>
                <span className="text-xs text-zinc-400">{i18n.t("chat.slash_quick")}</span>
              </div>
              <div className="max-h-64 overflow-y-auto p-1.5">
                {filteredSlash.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    onClick={() => handleSlashSelect(cmd)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                      idx === slashIndex ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", idx === slashIndex ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-800")}>
                      <cmd.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium", idx === slashIndex ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-white")}>{cmd.name}</div>
                      <div className={cn("text-xs truncate", idx === slashIndex ? "text-white/70 dark:text-zinc-600" : "text-zinc-500")}>{cmd.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-5 pt-4">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2.5 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 group"
                >
                  {att.type === "image" && att.url ? (
                    <img src={att.url} alt={att.name} className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
                  ) : att.type === "image" ? <Image className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                  <div className="flex flex-col min-w-0 max-w-[180px]">
                    <span className="truncate font-medium leading-none">{att.name}</span>
                    <span className="text-[11px] text-zinc-400 leading-none mt-0.5">{formatSize(att.size)} • {att.content ? `${att.content.length} chars` : ""}</span>
                  </div>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-60 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 px-4 pt-3.5 pb-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesChosen(e, "file")}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesChosen(e, "image")}
            />
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={handleFileSelect}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all border border-zinc-200/50 dark:border-zinc-700/50"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </TooltipTrigger><TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">{i18n.t("chat.attach_file")}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={handleImageSelect}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all border border-zinc-200/50 dark:border-zinc-700/50"
              >
                <Image className="h-4 w-4" />
              </button>
            </TooltipTrigger><TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">{i18n.t("chat.attach_image")}</TooltipContent></Tooltip>
            <div className="flex-1" />
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={() => chatStore.setInternetMode(!internetMode)}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-xl transition-all relative border",
                  internetMode
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md"
                    : "bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                )}
              >
                <Globe className="h-4 w-4" />
                {internetMode && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm" />}
              </button>
            </TooltipTrigger><TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">
              {internetMode ? i18n.t("chat.internet_search_active") : i18n.t("chat.internet_search")}
            </TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={() => chatStore.setThinkingMode(!thinkingMode)}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-xl transition-all relative border",
                  thinkingMode
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md"
                    : "bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                )}
              >
                <Brain className="h-4 w-4" />
                {thinkingMode && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm" />}
              </button>
            </TooltipTrigger><TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">
              {thinkingMode ? i18n.t("chat.thinking_mode_active") : i18n.t("chat.thinking_mode")}
            </TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={() => chatStore.setMcpMode(!mcpMode)}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-xl transition-all relative border",
                  mcpMode
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md"
                    : "bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                )}
              >
                <Blocks className="h-4 w-4" />
                {mcpMode && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm" />}
              </button>
            </TooltipTrigger><TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">
              {mcpMode ? i18n.t("chat.mcp_tools_active") : i18n.t("chat.mcp_tools")}
            </TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button
                onClick={() => setMcpOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all border border-zinc-200/50 dark:border-zinc-700/50"
              >
                <Wrench className="h-4 w-4" />
              </button>
            </TooltipTrigger><TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">{i18n.t("chat.configure_mcp")}</TooltipContent></Tooltip>
            {isLocalProvider && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "h-9 px-2.5 flex items-center justify-center gap-1 rounded-xl transition-all border text-xs font-semibold font-mono",
                          maxContextTokens !== 4096
                            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md"
                            : "bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                        )}
                      >
                        <Layers className="h-4 w-4" />
                        {formatCtx(maxContextTokens)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl">
                      <div className="space-y-2 p-1">
                        <p className="text-sm font-medium">
                          {locale === "ru" ? "Контекст локальной модели" : "Local model context"}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {locale === "ru"
                            ? "Больше контекста — больше памяти. Перезапускает встроенный движок."
                            : "More context needs more RAM. Restarts the built-in engine."}
                        </p>
                        <div className="grid grid-cols-5 gap-1">
                          {CONTEXT_OPTIONS.map((v) => (
                            <button
                              key={v}
                              onClick={() => handleCtxSelect(v)}
                              className={cn(
                                "h-7 rounded-lg text-[11px] font-mono font-medium transition-all",
                                maxContextTokens === v
                                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                              )}
                            >
                              {formatCtx(v)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">
                  {locale === "ru" ? `Контекст: ${formatCtx(maxContextTokens)}` : `Context: ${formatCtx(maxContextTokens)}`}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "h-9 w-9 flex items-center justify-center rounded-xl transition-all border",
                        temperature !== 0.7
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md"
                          : "bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                      )}
                    >
                      <Thermometer className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>                  <PopoverContent side="top" align="end" className="w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl">
                    <div className="space-y-4 p-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{i18n.t("chat.temperature")}</span>
                        <span className="text-sm font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">{temperature.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[temperature]}
                        onValueChange={([v]) => chatStore.setTemperature(v)}
                        min={0}
                        max={2}
                        step={0.05}
                      />
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{i18n.t("chat.temperature_exact")}</span>
                        <span>{i18n.t("chat.temperature_creative")}</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {[0, 0.3, 0.7, 1.0, 1.5, 2.0].map((v) => (
                          <button
                            key={v}
                            onClick={() => chatStore.setTemperature(v)}
                            className={cn(
                              "h-7 rounded-lg text-xs font-medium transition-all",
                              temperature === v
                                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            )}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-zinc-900 text-white text-xs">
                {i18n.t("chat.temperature")}: {temperature.toFixed(1)}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="px-5 pb-3">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => chatStore.setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={`${i18n.t("chat.input_placeholder")}${i18n.t("chat.commands_hint")}`}
              rows={1}
              className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 py-2.5 max-h-[40vh] leading-relaxed font-[450]"
            />
          </div>

          <div className="flex items-center justify-between px-4 pb-3">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <span className="hidden sm:inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium border border-zinc-200 dark:border-zinc-700">⇧</span>
                <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium border border-zinc-200 dark:border-zinc-700">↵</span>
                {i18n.t("chat.new_line")}
              </span>
              <span className="sm:hidden">{isStreaming ? i18n.t("chat.generating_short") : i18n.t("chat.send_short")}</span>
            </span>
            <button
              onClick={isStreaming ? () => chatStore.stopStreaming() : handleSend}
              disabled={(!inputValue.trim() && attachments.length===0) && !isStreaming}
              className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200",
                isStreaming
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20"
                  : (inputValue.trim() || attachments.length>0)
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-md shadow-zinc-900/10 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
              )}
            >
              {isStreaming ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-4 w-4 ml-0.5" />}
            </button>
          </div>
        </motion.div>
        <MCPPanel open={mcpOpen} onClose={() => setMcpOpen(false)} />
      </TooltipProvider>
    </div>
  );
}
