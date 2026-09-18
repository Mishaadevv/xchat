import { useState, useMemo } from "react";
import { Search, Star, Download, Verified, Blocks, BookOpen, Wrench, Palette, Filter, Plus, Trash2, ExternalLink, X, Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/useStore";
import { i18n } from "@/services/i18n";

type Category = "all" | "extensions" | "prompts" | "themes" | "mcp" | "models";

interface ShopItem {
  id: string;
  name: string;
  author: string;
  description: string;
  descriptionEn: string;
  category: Exclude<Category, "all">;
  url?: string;          // optional install URL or homepage
  priceUsd: number;      // 0 = free
  rating: number;
  downloads: string;
  verified?: boolean;
  builtin?: boolean;
}

// ── Currency detection by locale ────────────────────────────────────────────
const CURRENCY_MAP: Record<string, { symbol: string; code: string; rate: number }> = {
  "RU": { symbol: "₽", code: "RUB", rate: 85 },
  "BY": { symbol: "Br", code: "BYN", rate: 3.2 },
  "KZ": { symbol: "₸", code: "KZT", rate: 450 },
  "UA": { symbol: "₴", code: "UAH", rate: 41 },
  "UZ": { symbol: "сўм", code: "UZS", rate: 12500 },
  "DE": { symbol: "€", code: "EUR", rate: 0.92 },
  "FR": { symbol: "€", code: "EUR", rate: 0.92 },
  "ES": { symbol: "€", code: "EUR", rate: 0.92 },
  "IT": { symbol: "€", code: "EUR", rate: 0.92 },
  "NL": { symbol: "€", code: "EUR", rate: 0.92 },
  "PL": { symbol: "zł", code: "PLN", rate: 3.95 },
  "CZ": { symbol: "Kč", code: "CZK", rate: 23 },
  "SE": { symbol: "kr", code: "SEK", rate: 10.5 },
  "GB": { symbol: "£", code: "GBP", rate: 0.79 },
  "US": { symbol: "$", code: "USD", rate: 1 },
  "CA": { symbol: "C$", code: "CAD", rate: 1.36 },
  "BR": { symbol: "R$", code: "BRL", rate: 5.0 },
  "MX": { symbol: "MX$", code: "MXN", rate: 17.2 },
  "CN": { symbol: "¥", code: "CNY", rate: 7.2 },
  "JP": { symbol: "¥", code: "JPY", rate: 155 },
  "KR": { symbol: "₩", code: "KRW", rate: 1350 },
  "IN": { symbol: "₹", code: "INR", rate: 83 },
  "TR": { symbol: "₺", code: "TRY", rate: 32 },
};

function detectCountry(): string {
  try {
    const locale = navigator.language || navigator.languages?.[0] || "en-US";
    const parts = locale.split("-");
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
    return "US";
  } catch { return "US"; }
}

function getCurrencyInfo() {
  const country = detectCountry();
  return CURRENCY_MAP[country] || CURRENCY_MAP["US"];
}

function formatPrice(usd: number): string {
  if (usd === 0) return "";
  const { symbol, code, rate } = getCurrencyInfo();
  const local = Math.round(usd * rate * 100) / 100;
  if (code === "JPY" || code === "KRW" || code === "UZS") return `${Math.round(local)} ${symbol}`;
  return `${local} ${symbol}`;
}

const STORAGE_KEY = "zeqoux-marketplace-items";
const INSTALLED_KEY = "zeqoux-marketplace-installed";

function loadCustomItems(): ShopItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomItems(items: ShopItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadInstalled(): Set<string> {
  try {
    const raw = localStorage.getItem(INSTALLED_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch { return new Set(); }
}

function saveInstalled(ids: Set<string>) {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify([...ids]));
}

export function MarketplacePage() {
  const _locale = useStore(i18n.subscribe, i18n.getLocale);
  const locale = _locale || "en";
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [installed, setInstalled] = useState<Set<string>>(() => loadInstalled());
  const [customItems, setCustomItems] = useState<ShopItem[]>(() => loadCustomItems());
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Add item form
  const [newName, setNewName] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<Exclude<Category, "all">>("extensions");
  const [newUrl, setNewUrl] = useState("");
  const [newPrice, setNewPrice] = useState("0");

  const filtered = customItems.filter(it => {
    if (category !== "all" && it.category !== category) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q) || it.author.toLowerCase().includes(q);
  });

  const toggleInstall = (id: string) => {
    setInstalled(prev => {
      const n = new Set(prev);
      const was = n.has(id);
      if (was) n.delete(id); else n.add(id);
      saveInstalled(n);
      const item = customItems.find(it => it.id === id);
      const msg = was
        ? (locale === "ru" ? `Удалено: ${item?.name}` : `Removed: ${item?.name}`)
        : (locale === "ru" ? `Установлено: ${item?.name}` : `Installed: ${item?.name}`);
      setToast(msg);
      setTimeout(() => setToast(""), 2500);
      return n;
    });
  };

  const handleAddItem = () => {
    if (!newName.trim()) return;
    const item: ShopItem = {
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      author: newAuthor.trim() || "Custom",
      description: newDesc.trim(),
      descriptionEn: newDesc.trim(),
      category: newCategory,
      url: newUrl.trim() || undefined,
      priceUsd: parseFloat(newPrice) || 0,
      rating: 0,
      downloads: "—",
      verified: false,
      builtin: false,
    };
    const updated = [...customItems, item];
    setCustomItems(updated);
    saveCustomItems(updated);
    setNewName(""); setNewAuthor(""); setNewDesc(""); setNewUrl(""); setNewPrice("0");
    setShowAdd(false);
    setToast(locale === "ru" ? `Добавлено: ${item.name}` : `Added: ${item.name}`);
    setTimeout(() => setToast(""), 2500);
  };

  const handleRemoveItem = (id: string) => {
    const updated = customItems.filter(it => it.id !== id);
    setCustomItems(updated);
    saveCustomItems(updated);
    const newInstalled = new Set(installed);
    newInstalled.delete(id);
    setInstalled(newInstalled);
    saveInstalled(newInstalled);
  };

  const handleExport = () => {
    const data = JSON.stringify(customItems, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zeqoux-marketplace-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const items = JSON.parse(text) as ShopItem[];
        if (!Array.isArray(items)) return;
        const updated = [...customItems];
        for (const item of items) {
          if (!item.id || !item.name) continue;
          if (updated.some(e => e.id === item.id)) continue;
          updated.push({ ...item, id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
        }
        setCustomItems(updated);
        saveCustomItems(updated);
        setToast(locale === "ru" ? `Импортировано ${items.length} items` : `Imported ${items.length} items`);
        setTimeout(() => setToast(""), 2500);
      } catch { /* invalid json */ }
    };
    input.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Blocks className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">{i18n.t("marketplace.title")}</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{i18n.t("marketplace.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />{locale === "ru" ? "Импорт" : "Import"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={customItems.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />{locale === "ru" ? "Экспорт" : "Export"}
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />{locale === "ru" ? "Добавить" : "Add"}
          </Button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-3 border-b flex items-center gap-3 overflow-x-auto">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={i18n.t("marketplace.search")}
            className="w-full h-9 pl-9 pr-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1.5">
          {(["all","extensions","prompts","themes","mcp","models"] as Category[]).map(cat => (
            <button key={cat} onClick={()=>setCategory(cat)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                category===cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent")}>
              {cat==="all"?"All":cat==="extensions"?(locale==="ru"?"Расширения":"Extensions"):cat==="prompts"?(locale==="ru"?"Промпты":"Prompts"):cat==="themes"?(locale==="ru"?"Темы":"Themes"):cat==="mcp"?"MCP":(locale==="ru"?"Модели":"Models")}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="mx-6 mt-4 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Download className="h-4 w-4" />
          {toast}
        </div>
      )}

      {showAdd && (
        <div className="mx-6 mt-4 border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{locale === "ru" ? "Добавить расширение / тему / промпт" : "Add extension / theme / prompt"}</h3>
            <button onClick={() => setShowAdd(false)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{locale === "ru" ? "Название *" : "Name *"}</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)}
                placeholder={locale === "ru" ? "Название расширения" : "Extension name"}
                className="w-full h-9 px-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{locale === "ru" ? "Автор" : "Author"}</label>
              <input value={newAuthor} onChange={e=>setNewAuthor(e.target.value)}
                placeholder={locale === "ru" ? "Имя автора" : "Author name"}
                className="w-full h-9 px-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium">{locale === "ru" ? "Описание" : "Description"}</label>
              <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} rows={2}
                placeholder={locale === "ru" ? "Что делает этот элемент" : "What does this item do"}
                className="w-full p-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{locale === "ru" ? "Категория" : "Category"}</label>
              <select value={newCategory} onChange={e=>setNewCategory(e.target.value as any)}
                className="w-full h-9 px-3 bg-secondary rounded-md text-sm outline-none border border-input">
                <option value="extensions">{locale === "ru" ? "Расширения" : "Extensions"}</option>
                <option value="prompts">{locale === "ru" ? "Промпты" : "Prompts"}</option>
                <option value="themes">{locale === "ru" ? "Темы" : "Themes"}</option>
                <option value="mcp">MCP</option>
                <option value="models">{locale === "ru" ? "Модели" : "Models"}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{locale === "ru" ? "URL (необязательно)" : "URL (optional)"}</label>
              <input value={newUrl} onChange={e=>setNewUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-9 px-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{locale === "ru" ? "Цена (USD, 0 = бесплатно)" : "Price (USD, 0 = free)"}</label>
              <input type="number" min={0} step={0.01} value={newPrice} onChange={e=>setNewPrice(e.target.value)}
                className="w-full h-9 px-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={()=>setShowAdd(false)}>{locale === "ru" ? "Отмена" : "Cancel"}</Button>
            <Button size="sm" onClick={handleAddItem} disabled={!newName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />{locale === "ru" ? "Добавить" : "Add Item"}
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-6xl mx-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-xl">
              <Blocks className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {customItems.length === 0
                  ? (locale === "ru" ? "Маркет пока пуст" : "Marketplace is empty")
                  : i18n.t("marketplace.not_found")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {customItems.length === 0
                  ? (locale === "ru" ? "Нажмите «Добавить» чтобы создать расширение, тему или промпт" : "Click «Add» to create an extension, theme, or prompt")
                  : (locale === "ru" ? "Попробуйте другой запрос" : "Try a different search")}
              </p>
              {customItems.length === 0 && (
                <Button size="sm" className="mt-4" onClick={() => setShowAdd(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />{locale === "ru" ? "Добавить первый элемент" : "Add first item"}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(item => (
                <div key={item.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {item.category==="mcp" ? <Wrench className="h-4 w-4 text-muted-foreground" /> :
                       item.category==="prompts" ? <BookOpen className="h-4 w-4 text-muted-foreground" /> :
                       item.category==="themes" ? <Palette className="h-4 w-4 text-muted-foreground" /> :
                       <Blocks className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium flex items-center gap-1.5">
                        {item.name} {item.verified && <Verified className="h-3.5 w-3.5 text-blue-500" />}
                      </h3>
                      <p className="text-xs text-muted-foreground">{item.author}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{item.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {locale === "en" ? item.descriptionEn : item.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    {item.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{item.rating}</span>}
                    <span className="flex items-center gap-1"><Download className="h-3 w-3" />{item.downloads}</span>
                    <span className="ml-auto font-medium text-foreground">
                      {item.priceUsd === 0 ? i18n.t("marketplace.price_free") : formatPrice(item.priceUsd)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={()=>toggleInstall(item.id)} className={cn("flex-1",
                      installed.has(item.id) ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "")}>
                      {installed.has(item.id) ? i18n.t("marketplace.installed") : i18n.t("marketplace.install")}
                    </Button>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-accent text-muted-foreground transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {!item.builtin && (
                      <button onClick={()=>handleRemoveItem(item.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
