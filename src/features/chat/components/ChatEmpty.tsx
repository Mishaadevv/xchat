import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Sparkles, Code2, Globe, FileText, Languages, SearchCode, ArrowRight, Settings2, Download } from "lucide-react";
import { useStore } from "@/lib/useStore";
import { cn } from "@/lib/utils";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { chatStore } from "../store/chatStore";
import { providerService } from "@/services/providers";
import { i18n } from "@/services/i18n";
import { appStore } from "@/app/store/appStore";

export function ChatEmpty() {
  const { model, provider } = useStore(chatStore.subscribe, chatStore.getState);
  const locale = useStore(i18n.subscribe, i18n.getLocale);
  const [showModels, setShowModels] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const quickActions = [
    { key: "explain", prompt: "Explain this code in detail", icon: Code2, color: "from-violet-600 to-indigo-600" },
    { key: "website", prompt: "Help me create a modern website", icon: Globe, color: "from-emerald-500 to-teal-600" },
    { key: "python", prompt: "Write a Python script that", icon: FileText, color: "from-orange-500 to-pink-500" },
    { key: "docs", prompt: "Generate documentation for", icon: FileText, color: "from-blue-500 to-cyan-500" },
    { key: "translate", prompt: "Translate this text", icon: Languages, color: "from-pink-500 to-rose-500" },
    { key: "analyze", prompt: "Analyze project files", icon: SearchCode, color: "from-amber-500 to-orange-500" },
  ];

  const providers = providerService.getProviders();
  const activeProvider = providers.find((p) => p.id === provider);
  const models = activeProvider?.models ?? [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModels(false);
        setModelSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (showModels && searchRef.current) searchRef.current.focus();
  }, [showModels]);

  const handleQuickAction = (prompt: string) => {
    const chat = sidebarStore.createChat(model || models[0], provider);
    chatStore.setInputValue(prompt);
  };

  const modelItems = providers
    .filter((p) => p.models.length > 0 || p.apiKey || p.type === "ollama")
    .flatMap((p) =>
      (p.models.length > 0 ? p.models : ["(no models)"]).map((m) => ({
        model: m,
        provider: p,
        isPlaceholder: m === "(no models)",
      }))
    )
    .filter((item) => {
      if (!modelSearch) return true;
      const q = modelSearch.toLowerCase();
      return (
        item.model.toLowerCase().includes(q) ||
        item.provider.name.toLowerCase().includes(q) ||
        item.provider.baseUrl.toLowerCase().includes(q)
      );
    });

  const modelCount = providers.reduce((sum, p) => sum + p.models.length, 0);
  const setupStatus = providerService.getSetupStatus();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-white via-zinc-50/50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 relative">
      {/* subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />
      
      <div className="flex flex-col items-center gap-8 max-w-2xl w-full text-center relative mx-auto px-6 py-12 min-h-full justify-center">
        {/* Logo */}
        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-violet-600/20 rounded-full blur-2xl" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/20">
            <span className="text-3xl font-bold text-white tracking-tight">Z</span>
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-sm">
            <Sparkles className="h-3 w-3 text-violet-600" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            ZeqouXChat
          </h1>
          <p className="text-[15px] text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            {i18n.t("empty.subtitle")}
          </p>
        </div>

        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setShowModels(!showModels)}
            className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-sm shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-zinc-900 dark:text-white">{model || (models[0] ?? i18n.t("chat.select_model"))}</span>
            <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-zinc-500 dark:text-zinc-400 text-xs">{(activeProvider?.name ?? provider) || i18n.t("hub.providers")}</span>
            <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform", showModels && "rotate-180")} />
          </button>

          {showModels && (
            <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder={i18n.t("hub.search_models")}
                    className="w-full h-9 pl-9 pr-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none placeholder:text-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-2">
                {modelItems.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-zinc-500 mb-3">
                      {modelSearch ? i18n.t("chat.no_messages_hint") : (locale === "ru" ? "Нет доступных моделей" : "No models available")}
                    </p>
                    {!modelSearch && (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-400">
                          {locale === "ru" ? "Для работы из коробки установите Ollama:" : "For out-of-the-box usage, install Ollama:"}
                        </p>
                        <a href="https://ollama.com" target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
                          <Download className="h-3 w-3" />ollama.com
                        </a>
                        <p className="text-[11px] text-zinc-400">
                          {locale === "ru" ? "или добавьте API ключ в Настройках" : "or add an API key in Settings"}
                        </p>
                        <button onClick={() => { setShowModels(false); appStore.setView("settings"); }}
                          className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium mt-1">
                          <Settings2 className="h-3 w-3" />{locale === "ru" ? "Открыть настройки" : "Open Settings"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  modelItems.map(({ model: m, provider: p, isPlaceholder }) => (
                    <button
                      key={`${p.id}-${m}`}
                      disabled={isPlaceholder}
                      onClick={() => {
                        if (isPlaceholder) return;
                        chatStore.setProvider(p.id);
                        chatStore.setModel(m);
                        localStorage.setItem("zeqouxchat-last-model", JSON.stringify({ model: m, provider: p.id }));
                        setShowModels(false);
                        setModelSearch("");
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                        model === m && provider === p.id ? "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300" : "text-zinc-700 dark:text-zinc-300",
                        isPlaceholder && "opacity-50 cursor-default"
                      )}
                    >
                      <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0 min-w-[60px] text-center">
                        {p.name}
                      </span>
                      <span className="truncate font-medium">{isPlaceholder ? i18n.t("hub.no_models") : m}</span>
                    </button>
                  ))
                )}
              </div>
              {modelCount > 0 && (
                <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                  <p className="text-xs text-zinc-500 text-center">
                    {i18n.t("hub.models_count", { n: modelCount, m: providers.filter((p) => p.models.length > 0).length })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          {quickActions.map((action) => (
            <button
              key={action.key}
              onClick={() => handleQuickAction(action.prompt)}
              className="group relative flex items-start gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all text-left overflow-hidden"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br text-white shadow-sm", (action as any).color || "from-zinc-600 to-zinc-800")}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-zinc-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors flex items-center gap-1">
                  {i18n.t(`empty.quick_${action.key}`)}
                  <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{i18n.t(`empty.quick_${action.key}_desc`)}</div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-600 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          {i18n.t("empty.hint")}
          <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </p>
      </div>
    </div>
  );
}
