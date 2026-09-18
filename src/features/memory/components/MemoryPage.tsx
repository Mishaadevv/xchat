import { useState } from "react";
import { Brain, Search, Plus, Trash2, Edit2, Pin, Filter, Download, Upload, Settings2, X, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/useStore";
import { cn } from "@/lib/utils";
import { memoryService, type MemoryEntry, type MemorySettings } from "@/services/memory";
import { i18n } from "@/services/i18n";

export function MemoryPage() {
  const { entries, settings } = useStore(memoryService.subscribe, memoryService.getState);
  const _locale = useStore(i18n.subscribe, i18n.getLocale);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<MemoryEntry["type"]>("fact");
  const [newImportance, setNewImportance] = useState<MemoryEntry["importance"]>("medium");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const filtered = entries.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.content.toLowerCase().includes(q) || (e.title && e.title.toLowerCase().includes(q)) || e.tags.join(" ").toLowerCase().includes(q);
  });

  const handleAdd = () => {
    if (!newContent.trim()) return;
    memoryService.add(newContent, { type: newType, importance: newImportance });
    setNewContent("");
    setShowAdd(false);
  };

  const handleExport = () => {
    const data = memoryService.export();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zeqoux-memory-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const added = memoryService.import(text);
      alert(i18n.t("memory.imported", { n: added }));
    };
    input.click();
  };

  const updateSetting = (patch: Partial<MemorySettings>) => memoryService.updateSettings(patch);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Brain className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold flex items-center gap-2">{i18n.t("memory.title")} <Badge variant="secondary" className="text-[10px]">{entries.length}</Badge></h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{i18n.t("memory.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}><Upload className="h-3.5 w-3.5 mr-1.5" />{i18n.t("memory.import")}</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1.5" />{i18n.t("memory.export")}</Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-3.5 w-3.5 mr-1.5" />{i18n.t("memory.add")}</Button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-3 border-b">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={i18n.t("memory.search_placeholder")}
              className="w-full h-9 pl-9 pr-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {["all","fact","preference","task","user","custom"].map(t=>(
              <button key={t} onClick={()=>setFilterType(t)}
                className={cn("px-3 py-1.5 rounded-md text-xs transition-colors",
                  filterType===t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent")}>
                {t==="all"? i18n.t("marketplace.filter_all"):t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <div className="border rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-muted-foreground" />{i18n.t("memory.enabled")}</span>
                <button onClick={()=>updateSetting({enabled: !settings.enabled})}
                  className={cn("h-6 w-10 rounded-full relative transition-colors", settings.enabled ? "bg-primary" : "bg-secondary")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 bg-white rounded-full shadow-sm border transition-all", settings.enabled ? "right-0.5" : "left-0.5")} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>{i18n.t("memory.ai_write")}</span>
                <button onClick={()=>updateSetting({allowAIWrite: !settings.allowAIWrite})}
                  className={cn("h-6 w-10 rounded-full relative transition-colors", settings.allowAIWrite ? "bg-primary" : "bg-secondary")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 bg-white rounded-full shadow-sm border transition-all", settings.allowAIWrite ? "right-0.5" : "left-0.5")} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>{i18n.t("memory.ai_delete")}</span>
                <button onClick={()=>updateSetting({allowAIDelete: !settings.allowAIDelete})}
                  className={cn("h-6 w-10 rounded-full relative transition-colors", settings.allowAIDelete ? "bg-primary" : "bg-secondary")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 bg-white rounded-full shadow-sm border transition-all", settings.allowAIDelete ? "right-0.5" : "left-0.5")} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>{i18n.t("memory.include_context", {n: settings.maxContextEntries})}</span>
                <button onClick={()=>updateSetting({includeInContext: !settings.includeInContext})}
                  className={cn("h-6 w-10 rounded-full relative transition-colors", settings.includeInContext ? "bg-primary" : "bg-secondary")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 bg-white rounded-full shadow-sm border transition-all", settings.includeInContext ? "right-0.5" : "left-0.5")} />
                </button>
              </label>
            </div>
          </div>

          {showAdd && (
            <div className="border rounded-xl p-4 space-y-3">
              <textarea value={newContent} onChange={e=>setNewContent(e.target.value)} placeholder={i18n.t("memory.placeholder")}
                className="w-full min-h-[80px] p-3 bg-secondary rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
              <div className="flex gap-2">
                <select value={newType} onChange={e=>setNewType(e.target.value as any)}
                  className="h-9 px-3 bg-secondary rounded-md text-xs outline-none">
                  <option value="fact">{i18n.t("memory.type_fact")}</option><option value="preference">{i18n.t("memory.type_preference")}</option><option value="task">{i18n.t("memory.type_task")}</option><option value="user">{i18n.t("memory.type_user")}</option><option value="custom">{i18n.t("memory.type_custom")}</option>
                </select>
                <select value={newImportance} onChange={e=>setNewImportance(e.target.value as any)}
                  className="h-9 px-3 bg-secondary rounded-md text-xs outline-none">
                  <option value="low">{i18n.t("memory.low")}</option><option value="medium">{i18n.t("memory.medium")}</option><option value="high">{i18n.t("memory.high")}</option>
                </select>
                <Button size="sm" onClick={handleAdd} className="ml-auto"><Save className="h-3.5 w-3.5 mr-1.5" />{i18n.t("memory.save")}</Button>
                <Button size="sm" variant="ghost" onClick={()=>setShowAdd(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">{i18n.t("memory.empty")}</p>
                <p className="text-xs text-muted-foreground mt-1">{i18n.t("memory.empty_hint")}</p>
              </div>
            ) : filtered.map(e=>(
              <div key={e.id} className={cn("border rounded-xl p-4 hover:shadow-sm transition-shadow", e.pinned && "ring-1 ring-amber-300")}>
                {editingId === e.id ? (
                  <div className="space-y-2">
                    <textarea value={editContent} onChange={ev=>setEditContent(ev.target.value)}
                      className="w-full min-h-[60px] p-3 bg-secondary rounded-md text-sm outline-none" />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={()=>setEditingId(null)}>{i18n.t("memory.cancel")}</Button>
                      <Button size="sm" onClick={()=>{ memoryService.update(e.id, { content: editContent }); setEditingId(null); }}>{i18n.t("memory.save")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold text-white",
                      e.importance==="high"?"bg-red-500": e.importance==="medium"?"bg-amber-500":"bg-muted-foreground")}>
                      {e.importance[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">{e.content}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{e.type}</Badge>
                        {e.tags.map(t=> <span key={t} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded-full">#{t}</span>)}
                        <span className="text-[10px] text-muted-foreground ml-auto">{new Date(e.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={()=>memoryService.update(e.id, { pinned: !e.pinned })}
                        className={cn("h-7 w-7 flex items-center justify-center rounded-lg", e.pinned ? "bg-amber-100 text-amber-600" : "hover:bg-secondary text-muted-foreground")} title={i18n.t("memory.pinned")}><Pin className="h-3.5 w-3.5" /></button>
                      <button onClick={()=>{ setEditingId(e.id); setEditContent(e.content); }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={()=>memoryService.remove(e.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
