import { useState, useMemo } from "react";
import { Eye, EyeOff, Check, Plus, RefreshCw, Trash2, Server, Wifi, WifiOff, Sun, Moon, Monitor, Search, Filter, ExternalLink, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/useStore";
import { providerService, PROVIDER_CATEGORIES, type ProviderConfig } from "@/services/providers";
import { themeStore, type Theme } from "@/services/theme";
import { i18n, type Locale } from "@/services/i18n";
import { settingsStore } from "@/services/settingsStore";
import { onboardingStore } from "@/features/onboarding/services/onboardingStore";
import { getDownloadedModels } from "@/services/downloads";
import { navVisibility, type NavId } from "@/services/navVisibility";
import { Blocks, Folder, Brain, Database, Store, Download, Puzzle } from "lucide-react";

const categories = [
  { id: "providers", label: "Providers" },
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "chat", label: "Chat" },
  { id: "navigation", label: () => i18n.t("settings.navigation") },
  { id: "about", label: "About" },
];

const PROVIDER_TAB_ORDER: (keyof typeof PROVIDER_CATEGORIES)[] = ["core","aggregator","hyperscaler","inference","local","regional","china","enterprise"];

export function SettingsPage() {
  const [active, setActive] = useState("providers");
  const currentTheme = useStore(themeStore.subscribe, themeStore.getState);
  const [providers, setProviders] = useState<ProviderConfig[]>(() => providerService.getProviders());
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [localKeys, setLocalKeys] = useState<Record<string, string>>(() => {
    const keys: Record<string, string> = {};
    for (const p of providerService.getProviders()) keys[p.id] = p.apiKey;
    return keys;
  });
  const [savedToast, setSavedToast] = useState("");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newKey, setNewKey] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const { sendOnEnter, startOnBoot } = useStore(settingsStore.subscribe, settingsStore.getState);
  const locale = useStore(i18n.subscribe, i18n.getLocale);

  // new: search & filter for massive provider list
  const [providerSearch, setProviderSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [configuredOnly, setConfiguredOnly] = useState(false);

  const loadProviders = () => setProviders(providerService.getProviders());

  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (configuredOnly) {
        const isConfigured = p.apiKey.length > 0 || p.type === "ollama";
        if (!isConfigured) return false;
      }
      if (providerSearch) {
        const q = providerSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.baseUrl.toLowerCase().includes(q);
      }
      return true;
    });
  }, [providers, providerSearch, categoryFilter, configuredOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProviderConfig[]>();
    for (const p of filteredProviders) {
      const cat = p.category || "enterprise";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    // order groups by predefined order
    const ordered: [string, ProviderConfig[]][] = [];
    for (const k of PROVIDER_TAB_ORDER) {
      if (map.has(k)) ordered.push([k, map.get(k)!]);
    }
    for (const [k, v] of map.entries()) {
      if (!PROVIDER_TAB_ORDER.includes(k as any)) ordered.push([k, v]);
    }
    return ordered;
  }, [filteredProviders]);

  const configuredCount = providers.filter(p => p.apiKey.length > 0 || p.type === "ollama").length;
  const totalModels = providers.reduce((acc, p) => acc + p.models.length, 0);

  const handleSaveKey = async (id: string) => {
    providerService.setApiKey(id, localKeys[id] ?? "");
    setSavedToast("API key saved");
    setRefreshing(id);
    const models = await providerService.refreshModels(id);
    if (models.length > 0) {
      setSavedToast(`Found ${models.length} models`);
    } else {
      setSavedToast("API key saved");
    }
    setRefreshing(null);
    loadProviders();
    setTimeout(() => setSavedToast(""), 2000);
  };

  const handleAddProvider = async () => {
    setAddError("");
    if (!newUrl.trim()) { setAddError("Enter a base URL"); return; }
    setAdding(true);
    try {
      const p = await providerService.addProvider(
        newName.trim() || newUrl.trim(),
        newUrl.trim(),
        newKey.trim()
      );
      setLocalKeys((prev) => ({ ...prev, [p.id]: newKey.trim() }));
      setNewName(""); setNewUrl(""); setNewKey("");
      setShowAddForm(false);
      loadProviders();
      setSavedToast(`Added ${p.name} (${p.models.length} models)`);
      setTimeout(() => setSavedToast(""), 2000);
    } catch (e: any) {
      setAddError(e.message || "Failed to add provider");
    }
    setAdding(false);
  };

  const handleRefresh = async (id: string) => {
    setRefreshing(id);
    const models = await providerService.refreshModels(id);
    setRefreshing(null);
    loadProviders();
    setSavedToast(models.length > 0 ? `Found ${models.length} models` : "No models found — check key / URL");
    setTimeout(() => setSavedToast(""), 2500);
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    let found = 0;
    for (const p of providers) {
      if (p.apiKey || p.type === "ollama") {
        const m = await providerService.refreshModels(p.id);
        found += m.length;
      }
    }
    setRefreshingAll(false);
    loadProviders();
    setSavedToast(found > 0 ? `Refreshed ${found} models` : "No models discovered — add API keys");
    setTimeout(() => setSavedToast(""), 2500);
  };

  const handleRemove = (id: string) => {
    providerService.removeProvider(id);
    loadProviders();
  };

  return (
    <div className="flex-1 flex h-full relative">
      {/* Floating round button: recommended free local models (always available) */}
      <button
        onClick={() => onboardingStore.open()}
        title={locale === "ru" ? "Рекомендуемые модели — скачать и посмотреть" : "Recommended models — download and info"}
        aria-label={locale === "ru" ? "Рекомендуемые модели" : "Recommended models"}
        className="absolute bottom-6 right-6 z-20 h-12 w-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-violet-500/25 hover:scale-105 active:scale-95 transition-transform"
      >
        <Sparkles className="h-5 w-5" />
        {Object.keys(getDownloadedModels()).length === 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white dark:border-zinc-950" />
        )}
      </button>
      <div className="w-52 border-r shrink-0 py-4 bg-secondary/30 overflow-y-auto">
        <div className="px-4 mb-4">
          <h1 className="text-sm font-semibold">Settings</h1>
        </div>
        <div className="space-y-0.5 px-2">
          {categories.map((cat) => {
            const label = typeof cat.label === "function" ? (cat.label as () => string)() : cat.label;
            return (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                  active === cat.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {active === "providers" && (
          <div className="mt-6 px-3 space-y-2">
            <div className="text-[11px] text-muted-foreground space-y-1 border-t pt-3">
              <div className="flex justify-between"><span>Total</span><span className="font-medium text-foreground">{providers.length}</span></div>
              <div className="flex justify-between"><span>Configured</span><span className="font-medium text-foreground">{configuredCount}</span></div>
              <div className="flex justify-between"><span>Models</span><span className="font-medium text-foreground">{totalModels}</span></div>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 h-full">
        <div className="p-8 max-w-[860px]">
          {active === "providers" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">Providers <Badge variant="secondary" className="text-[10px]">{providers.length}</Badge></h2>
                  <p className="text-xs text-muted-foreground">
                    {filteredProviders.length !== providers.length ? `Showing ${filteredProviders.length} of ${providers.length} • ` : ""}OpenAI-compatible, Anthropic & local endpoints. Keys stored locally.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={handleRefreshAll} disabled={refreshingAll}>
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1", refreshingAll && "animate-spin")} /> {refreshingAll ? "Refreshing..." : "Refresh all"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add by IP
                  </Button>
                </div>
              </div>

              {savedToast && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <Check className="h-3.5 w-3.5" />
                  {savedToast}
                </div>
              )}

              {showAddForm && (
                <div className="border border-border rounded-xl p-4 bg-secondary/20">
                  <p className="text-xs font-medium mb-3">Add Provider by IP / URL</p>
                  <div className="space-y-2">
                    <Input
                      placeholder="Name (optional, e.g. My Server)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <Input
                      placeholder="Base URL (e.g. http://192.168.1.100:11434 or https://api.openai.com/v1)"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <Input
                      placeholder="API Key (optional for local)"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                    />
                    {addError && <p className="text-xs text-destructive">{addError}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddProvider} disabled={adding}>
                        {adding ? "Connecting..." : "Add"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Auto-detects Ollama vs OpenAI. Common: 11434 (Ollama), 1234/v1 (LM Studio), 8000/v1 (vLLM).</p>
                  </div>
                </div>
              )}

              {/* Search & filters */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder="Search providers... (name, id, url)"
                      className="w-full h-9 pl-8 pr-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                    />
                  </div>
                  <Button variant={configuredOnly ? "default" : "outline"} size="sm" onClick={() => setConfiguredOnly(!configuredOnly)} className="h-9">
                    <Filter className="h-3.5 w-3.5 mr-1" /> {configuredOnly ? "Configured" : "All"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setCategoryFilter("all")} className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors", categoryFilter==="all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary hover:bg-accent border-transparent")}>
                    All ({providers.length})
                  </button>
                  {PROVIDER_TAB_ORDER.map((cat) => {
                    const count = providers.filter(p=>p.category===cat).length;
                    if (count===0) return null;
                    return (
                      <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors", categoryFilter===cat ? "bg-primary text-primary-foreground border-primary" : "bg-secondary hover:bg-accent border-transparent")}>
                        {PROVIDER_CATEGORIES[cat]} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grouped list */}
              <div className="space-y-8">
                {grouped.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No providers match filter</p>
                ) : grouped.map(([cat, list]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{PROVIDER_CATEGORIES[cat as keyof typeof PROVIDER_CATEGORIES] || cat}</h3>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{list.length}</span>
                      <div className="flex-1 h-px bg-border ml-2" />
                    </div>
                    <div className="space-y-3">
                      {list.map((p) => (
                        <div key={p.id} className="border border-border rounded-xl p-4 hover:shadow-sm transition-shadow bg-card">
                          <div className="flex items-center justify-between mb-3 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                                  {p.name}
                                  {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3"/></a>}
                                  {p.id.startsWith("custom-") && <Badge variant="outline" className="text-[10px] py-0">custom</Badge>}
                                </p>
                                <p className="text-xs text-muted-foreground truncate max-w-[360px]" title={p.baseUrl}>{p.baseUrl}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                                p.models.length > 0 ? "bg-green-100 text-green-700 border border-green-200" : "bg-secondary text-muted-foreground"
                              )}>
                                {p.models.length > 0 ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {p.models.length > 0 ? `${p.models.length} models` : "No models"}
                              </span>
                              {p.id.startsWith("custom-") && (
                                <button
                                  onClick={() => handleRemove(p.id)}
                                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Remove"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              type={showKeys[p.id] ? "text" : "password"}
                              value={localKeys[p.id] ?? ""}
                              onChange={(e) => setLocalKeys({ ...localKeys, [p.id]: e.target.value })}
                              placeholder={p.type === "ollama" ? "No API key needed for Ollama" : `Enter ${p.name} API key...`}
                              className="w-full h-9 pl-3 pr-[136px] bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
                            />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                              <button
                                onClick={() => setShowKeys({ ...showKeys, [p.id]: !showKeys[p.id] })}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
                              >
                                {showKeys[p.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => handleSaveKey(p.id)}
                                className="h-7 px-2 flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => handleRefresh(p.id)}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
                                title="Refresh models"
                              >
                                <RefreshCw className={cn("h-3.5 w-3.5", refreshing === p.id && "animate-spin")} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto">
                            {(p.models || []).length === 0 ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                {p.type === "ollama" ? "Click refresh to discover local models" : p.baseUrl.includes("YOUR_") ? "Replace YOUR_* placeholder with real URL" : "Enter API key and save to discover models"}
                              </span>
                            ) : (
                              (p.models || []).map((m) => (
                                <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-transparent hover:border-border cursor-default">
                                  {m}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-border rounded-xl p-4 bg-secondary/30 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5"/> Aggregators unified under OpenAI API</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  OpenRouter, AIHubMix, CometAPI, EZModel, API2D, Portkey, Vercel AI Gateway, Helicone — one key, hundreds of models.<br/>
                  Hyperscaler free tiers: Groq, Cerebras, SambaNova, GitHub Models, Cloudflare Workers AI, Hugging Face.<br/>
                  Inference: SiliconFlow, Together, Fireworks, DeepInfra, Baseten, Modal, fal.ai, Novita, Hyperbolic, Nebius, Kluster, RunPod/Vast.ai.<br/>
                  {i18n.t("settings.providers_info2")}
                </p>
                <p className="text-xs text-muted-foreground">{i18n.t("settings.keys_local")}</p>
              </div>
            </div>
          )}

          {active === "general" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-1">{i18n.t("settings.general")}</h2>
              <p className="text-xs text-muted-foreground mb-4">{i18n.t("settings.general_startup_desc")}</p>
              <div className="flex items-center justify-between py-2">
                <div><p className="text-sm">{i18n.t("settings.general_startup")}</p><p className="text-xs text-muted-foreground">{i18n.t("settings.general_startup_desc")}</p></div>
                <div onClick={() => { settingsStore.setStartOnBoot(!startOnBoot); }} className={cn("h-6 w-10 rounded-full relative cursor-pointer transition-colors", startOnBoot ? "bg-primary" : "bg-secondary")}>
                  <div className={cn("h-5 w-5 rounded-full bg-white shadow-sm absolute top-0.5 border transition-all", startOnBoot ? "right-0.5" : "left-0.5")} />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm">{i18n.t("settings.language")}</p>
                  <p className="text-xs text-muted-foreground">{i18n.t("settings.language_hint")}</p>
                </div>
                <div className="flex gap-1">
                  {(["en", "ru"] as Locale[]).map((l) => (
                    <button key={l} onClick={() => i18n.setLocale(l)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", locale === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent")}>
                      {l === "en" ? "English" : "Русский"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {active === "appearance" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-1">Appearance</h2>
              <p className="text-xs text-muted-foreground mb-4">Customize the look</p>
              <div>
                <p className="text-sm mb-3">Theme</p>
                <div className="flex gap-2">
                  {([["light", Sun], ["dark", Moon], ["system", Monitor]] as [Theme, any][]).map(([t, Icon]) => (
                    <button
                      key={t}
                      onClick={() => themeStore.setTheme(t)}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm border transition-colors",
                        currentTheme === t
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-border rounded-xl p-4 bg-secondary/30">
                <p className="text-xs text-muted-foreground">
                  Changes apply immediately.
                </p>
              </div>
            </div>
          )}

          {active === "chat" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-1">{i18n.t("settings.chat")}</h2>
              <p className="text-xs text-muted-foreground mb-4">Chat settings</p>
              <div className="flex items-center justify-between py-2">
                <div><p className="text-sm">{i18n.t("settings.send_enter")}</p><p className="text-xs text-muted-foreground">{i18n.t("settings.send_enter_desc")}</p></div>
                <div onClick={() => settingsStore.setSendOnEnter(!sendOnEnter)} className={cn("h-6 w-10 rounded-full relative cursor-pointer transition-colors", sendOnEnter ? "bg-primary" : "bg-secondary")}>
                  <div className={cn("h-5 w-5 rounded-full bg-white shadow-sm absolute top-0.5 border transition-all", sendOnEnter ? "right-0.5" : "left-0.5")} />
                </div>
              </div>
            </div>
          )}

          {active === "navigation" && (
            <NavigationSettings />
          )}

          {active === "about" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-1">About</h2>
              <div className="border border-border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>0.1.0</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Developer</span><span>Zeqou</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Runtime</span><span>Tauri</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Providers</span><span>{providers.length}</span></div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function NavigationSettings() {
  const { hidden } = useStore(navVisibility.subscribe, navVisibility.getState);
  const locale = useStore(i18n.subscribe, i18n.getLocale);
  const allNav = [
    { id: "hub" as NavId, icon: Blocks, label: i18n.t("nav.hub") },
    { id: "projects" as NavId, icon: Folder, label: i18n.t("nav.projects") },
    { id: "training" as NavId, icon: Brain, label: i18n.t("nav.training") },
    { id: "memory" as NavId, icon: Database, label: i18n.t("nav.memory") },
    { id: "marketplace" as NavId, icon: Store, label: i18n.t("nav.marketplace") },
    { id: "downloads" as NavId, icon: Download, label: i18n.t("nav.downloads") },
    { id: "extensions" as NavId, icon: Puzzle, label: i18n.t("nav.extensions") },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">{i18n.t("settings.navigation")}</h2>
        <p className="text-xs text-muted-foreground mb-4">{i18n.t("settings.navigation_desc")}</p>
      </div>
      <div className="border border-border rounded-xl divide-y">
        {allNav.map((item) => {
          const isHidden = hidden.has(item.id);
          return (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{item.label}</span>
                {isHidden && <Badge variant="secondary" className="text-[10px]">hidden</Badge>}
              </div>
              <button
                onClick={() => (isHidden ? navVisibility.show(item.id) : navVisibility.hide(item.id))}
                className={cn(
                  "h-6 w-10 rounded-full relative cursor-pointer transition-colors shrink-0",
                  !isHidden ? "bg-primary" : "bg-secondary"
                )}
              >
                <span className={cn("absolute top-0.5 h-5 w-5 bg-white rounded-full shadow-sm border transition-all", !isHidden ? "right-0.5" : "left-0.5")} />
              </button>
            </div>
          );
        })}
      </div>
      {hidden.size > 0 && (
        <Button size="sm" variant="outline" onClick={() => navVisibility.showAll()} className="w-full">
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          {i18n.t("nav.show_all")} ({hidden.size})
        </Button>
      )}
      <div className="border border-border rounded-xl p-4 bg-secondary/30">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {locale === "ru"
            ? "Нажми ✕ у вкладки в боковой панели, чтобы скрыть. Скрытые вкладки остаются доступны здесь."
            : "Click ✕ on a tab in the sidebar to hide it. Hidden tabs can be restored here."}
        </p>
      </div>
    </div>
  );
}
