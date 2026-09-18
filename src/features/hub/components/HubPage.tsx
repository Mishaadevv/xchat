import { useState, useEffect, useMemo } from "react";
import { Search, RefreshCw, Plus, Server, Wifi, WifiOff, ExternalLink, Download, Globe, BookOpen, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { providerService, PROVIDER_CATEGORIES, type ProviderConfig } from "@/services/providers";
import { downloadService } from "@/services/downloads";
import { appStore } from "@/app/store/appStore";
import { i18n } from "@/services/i18n";
import { useStore } from "@/lib/useStore";

interface HFModel {
  id: string;
  author: string;
  downloads: number;
  likes: number;
  pipeline_tag: string;
}

const PROVIDER_TAB_ORDER: (keyof typeof PROVIDER_CATEGORIES)[] = ["core","aggregator","hyperscaler","inference","local","regional","china","enterprise"];

export function HubPage() {
  const _locale = useStore(i18n.subscribe, i18n.getLocale);
  const [view, setView] = useState<"providers" | "huggingface">("providers");
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [providerSearch, setProviderSearch] = useState("");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newKey, setNewKey] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const [hfModels, setHfModels] = useState<HFModel[]>([]);
  const [hfLoading, setHfLoading] = useState(false);
  const [hfSearch, setHfSearch] = useState("");
  const [hfCategory, setHfCategory] = useState("text-generation");

  const load = () => setProviders(providerService.getProviders());
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (view !== "huggingface") return;
    setHfLoading(true);
    const cat = hfCategory ? `?pipeline_tag=${hfCategory}` : "";
    fetch(`https://huggingface.co/api/models${cat}&sort=downloads&direction=-1&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHfModels(data);
        else if (Array.isArray(data?.models)) setHfModels(data.models);
      })
      .catch(() => {})
      .finally(() => setHfLoading(false));
  }, [view, hfCategory]);

  const handleRefresh = async (id: string) => {
    setRefreshing(id);
    await providerService.refreshModels(id);
    setRefreshing(null);
    load();
  };

  const handleAddProvider = async () => {
    setAddError("");
    if (!newUrl.trim()) { setAddError("Enter a base URL"); return; }
    setAdding(true);
    try {
      await providerService.addProvider(
        newName.trim() || newUrl.trim(),
        newUrl.trim(),
        newKey.trim()
      );
      setNewName(""); setNewUrl(""); setNewKey("");
      setShowAddForm(false);
      load();
    } catch (e: any) {
      setAddError(e.message || "Failed to add provider");
    }
    setAdding(false);
  };

  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (providerSearch) {
        const q = providerSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.baseUrl.toLowerCase().includes(q);
      }
      return true;
    });
  }, [providers, categoryFilter, providerSearch]);

  const groupedProviders = useMemo(() => {
    const map = new Map<string, ProviderConfig[]>();
    for (const p of filteredProviders) {
      const cat = p.category || "enterprise";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    const ordered: [string, ProviderConfig[]][] = [];
    for (const k of PROVIDER_TAB_ORDER) if (map.has(k)) ordered.push([k, map.get(k)!]);
    for (const [k, v] of map.entries()) if (!PROVIDER_TAB_ORDER.includes(k as any)) ordered.push([k, v]);
    return ordered;
  }, [filteredProviders]);

  const allModels = providers.flatMap((p) =>
    (p.models || []).map((m) => ({ model: m, provider: p }))
  );

  const filtered = allModels.filter((m) => {
    if (filterProvider !== "all" && m.provider.id !== filterProvider) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.model.toLowerCase().includes(q) ||
      m.provider.name.toLowerCase().includes(q)
    );
  });

  const hfFiltered = hfModels.filter((m) => {
    if (!hfSearch) return true;
    const q = hfSearch.toLowerCase();
    return m.id.toLowerCase().includes(q) || (m.author || "").toLowerCase().includes(q);
  });

  const categories = [
    { id: "providers", label: "My Providers", icon: Server },
    { id: "huggingface", label: "Hugging Face", icon: BookOpen },
  ];

  const hfCategories = [
    { value: "", label: "All" },
    { value: "text-generation", label: "Text Generation" },
    { value: "image-generation", label: "Image" },
    { value: "image-text-to-text", label: "Vision" },
    { value: "automatic-speech-recognition", label: "Audio" },
    { value: "embedding", label: "Embeddings" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0 gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold flex items-center gap-2">Hub {view==="providers" && <Badge variant="secondary" className="text-[10px]">{providers.length} providers • {allModels.length} models</Badge>}</h1>
          <div className="flex gap-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setView(cat.id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors",
                  view === cat.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === "providers" && (
            <>
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="w-40 h-9 pl-9 pr-3 bg-secondary rounded-md text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="h-9 px-3 bg-secondary rounded-md text-xs outline-none focus:ring-2 focus:ring-ring text-muted-foreground max-w-[160px]"
              >
                <option value="all">All providers</option>
                {providers.filter((p) => p.models.length > 0).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add by IP
              </Button>
            </>
          )}
          {view === "huggingface" && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={hfSearch}
                onChange={(e) => setHfSearch(e.target.value)}
                placeholder="Search Hugging Face..."
                className="w-56 h-9 pl-9 pr-3 bg-secondary rounded-md text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-[1160px] mx-auto">
          {view === "providers" && (
            <>
              {showAddForm && (
                <Card className="mb-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Add Provider by IP / URL</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Input
                        placeholder="Name (optional, e.g. My Local)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <Input
                        placeholder="Base URL (e.g. http://192.168.1.100:11434 or http://localhost:1234/v1)"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                      />
                      <Input
                        placeholder="API Key (optional, leave blank for Ollama/local)"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                      />
                      {addError && <p className="text-xs text-destructive">{addError}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddProvider} disabled={adding}>
                          {adding ? "Connecting..." : "Add Provider"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Common ports: 11434 (Ollama), 1234/v1 (LM Studio), 8000/v1 (vLLM)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Provider search + category filter */}
              <div className="mb-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input value={providerSearch} onChange={e=>setProviderSearch(e.target.value)} placeholder="Search providers... (e.g. SiliconFlow, Groq, Yandex)" className="w-full h-9 pl-8 pr-3 bg-secondary rounded-md text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
                  </div>
                  {providerSearch && <Button variant="ghost" size="sm" onClick={()=>setProviderSearch("")}>Clear</Button>}
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <button onClick={() => setCategoryFilter("all")} className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors", categoryFilter==="all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary hover:bg-accent border-transparent")}>All ({providers.length})</button>
                  {PROVIDER_TAB_ORDER.map(cat => {
                    const cnt = providers.filter(p=>p.category===cat).length;
                    if (!cnt) return null;
                    return <button key={cat} onClick={()=>setCategoryFilter(cat)} className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors", categoryFilter===cat ? "bg-primary text-primary-foreground border-primary" : "bg-secondary hover:bg-accent border-transparent")}>{PROVIDER_CATEGORIES[cat]} ({cnt})</button>;
                  })}
                </div>
              </div>

              <div className="mb-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Providers {categoryFilter!=="all" ? `• ${PROVIDER_CATEGORIES[categoryFilter as keyof typeof PROVIDER_CATEGORIES]}`: ""} <span className="text-muted-foreground font-normal">({filteredProviders.length})</span></h2>
                  <p className="text-xs text-muted-foreground hidden sm:block">{i18n.t("hub.hint")}</p>
                </div>
                {groupedProviders.length===0 ? <p className="text-sm text-muted-foreground text-center py-8">No providers match filter</p> :
                groupedProviders.map(([cat, list])=> (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{PROVIDER_CATEGORIES[cat as keyof typeof PROVIDER_CATEGORIES] || cat}</h3>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{list.length}</span>
                      <div className="flex-1 h-px bg-border ml-2" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {list.map((p) => (
                        <Card key={p.id} className="relative hover:shadow-sm transition-shadow flex flex-col">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                                <CardTitle className="text-sm truncate" title={p.name}>{p.name}</CardTitle>
                              </div>
                              <Badge variant={p.models.length > 0 ? "default" : "secondary"} className="shrink-0 text-[10px]">
                                {p.models.length > 0 ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                                {p.models.length} models
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 flex flex-col">
                            <p className="text-xs text-muted-foreground mb-2 truncate" title={p.baseUrl}>{p.baseUrl}</p>
                            {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1 mb-2"><Globe className="h-3 w-3"/>{p.website.replace(/^https?:\/\//,"")}</a>}
                            <div className="flex gap-1.5 flex-wrap max-h-[60px] overflow-y-auto mb-3">
                              {(p.models || []).length === 0 ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                  {p.baseUrl.includes("YOUR_") ? "Set real URL in Settings" : p.type === "ollama" ? "Click refresh to discover" : p.apiKey ? "Click refresh" : "Add API key in Settings"}
                                </span>
                              ) : (
                                (p.models || []).slice(0, 8).map((m) => (
                                  <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground truncate max-w-[140px]">
                                    {m}
                                  </span>
                                ))
                              )}
                              {(p.models || []).length > 8 && (
                                <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                                  +{p.models.length - 8} more
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 mt-auto pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefresh(p.id)}
                                disabled={refreshing === p.id}
                                className="flex-1"
                              >
                                <RefreshCw className={cn("h-3 w-3 mr-1", refreshing === p.id && "animate-spin")} />
                                {refreshing === p.id ? "Loading..." : "Refresh"}
                              </Button>
                              {p.id.startsWith("custom-") && (
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                  onClick={() => { providerService.removeProvider(p.id); load(); }}>
                                  Remove
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <h2 className="text-sm font-semibold mb-3">
                  Available Models
                  {search && <span className="text-muted-foreground font-normal ml-1">({filtered.length} results)</span>}
                  {!search && !filtered.length && <span className="text-muted-foreground font-normal ml-1">— add keys & refresh to populate</span>}
                </h2>
                {filtered.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-xl bg-secondary/20">
                    <p className="text-sm text-muted-foreground">
                      {search ? "No models match your search" : providers.length === 0 ? "Add a provider to see models" : "No models found. Go to Settings → Providers, enter API keys, hit Save/Refresh."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">{i18n.t("hub.supported", { list: Object.values(PROVIDER_CATEGORIES).join(" • ") })}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.slice(0, 120).map(({ model, provider }) => (
                      <Card key={`${provider.id}-${model}`} className="hover:shadow-sm transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm truncate max-w-[200px]" title={model}>
                            {model}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Server className="h-3 w-3" />
                            <span className="truncate">{provider.name}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">{provider.category}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mb-3" title={provider.baseUrl}>{provider.baseUrl}</p>
                          <Button size="sm" className="w-full" variant="outline"
                            onClick={() => {
                              localStorage.setItem("zeqouxchat-last-model", JSON.stringify({ model, provider: provider.id }));
                              appStore.setView("chat");
                            }}>
                            <ExternalLink className="h-3 w-3 mr-1" /> Select
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    {filtered.length > 120 && <p className="text-xs text-muted-foreground col-span-full text-center py-2">Showing 120 of {filtered.length} — use search to narrow</p>}
                  </div>
                )}
              </div>
            </>
          )}

          {view === "huggingface" && (
            <div>
              <div className="flex gap-2 mb-6 flex-wrap">
                {hfCategories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setHfCategory(cat.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs transition-colors",
                      hfCategory === cat.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {hfLoading ? (
                <div className="text-center py-16">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-3">Loading models...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hfFiltered.slice(0, 30).map((m) => (
                    <Card key={m.id} className="hover:shadow-sm transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm truncate max-w-[180px]" title={m.id}>
                            {m.id.split("/").pop()}
                          </CardTitle>
                          <Badge variant="secondary" className="text-[10px]">{m.pipeline_tag || "other"}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-2 truncate">{m.author}/{m.id.split("/").pop()}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" /> {m.downloads ? formatNum(m.downloads) : "?"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(`https://huggingface.co/${m.id}`, "_blank")}>
                            <Globe className="h-3 w-3 mr-1" /> View
                          </Button>
                          <Button size="sm" className="flex-1" onClick={() => downloadModel(m.id)}>
                            <Download className="h-3 w-3 mr-1" /> Download
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!hfLoading && hfFiltered.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No models found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

async function downloadModel(modelId: string) {
  window.open(`https://huggingface.co/${modelId}`, "_blank");
  const files = await downloadService.findModelFiles(modelId);
  if (files.length > 0) {
    downloadService.startDownload(modelId, files[0]);
  } else {
    downloadService.startDownload(modelId);
  }
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
