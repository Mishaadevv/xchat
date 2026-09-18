import { useState, useMemo } from "react";
import { Blocks, Search, Wrench, FileCode, Globe, Terminal as TerminalIcon, X, Play, FileText, FileEdit, FolderTree, Link, CheckCircle, AlertCircle, Folder, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { executeMCPStep, type MCPTool, type MCPResult, type MCPFileInput } from "@/services/mcp";
import { db } from "@/services/db";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { projectService } from "@/services/projects";

const STORAGE_KEY = "zeqouxchat-mcp-tools";

const toolIcons: Record<string, any> = {
  "read-file": FileText, "write-file": FileEdit, "list-dir": FolderTree,
  "web-search": Globe, "fetch-url": Link,
  "run-code": TerminalIcon, "terminal": TerminalIcon,
  "train-model": Brain, "list-tools": Wrench,
};

const categoryIcons: Record<string, any> = { code: FileCode, web: Globe, system: TerminalIcon, custom: Wrench };
const categoryLabels: Record<string, string> = { code: "Code", web: "Web", data: "Data", system: "System", custom: "Custom" };

const defaultTools: MCPTool[] = [
  { id: "read-file", name: "Read File", description: "Read contents of a file from the filesystem", icon: "FileText", category: "system", enabled: true },
  { id: "write-file", name: "Write File", description: "Write content to a file on the filesystem", icon: "FileEdit", category: "system", enabled: true },
  { id: "list-dir", name: "List Directory", description: "List files and folders in a directory", icon: "FolderTree", category: "system", enabled: true },
  { id: "web-search", name: "Web Search", description: "Search the internet for information", icon: "Globe", category: "web", enabled: true },
  { id: "fetch-url", name: "Fetch URL", description: "Fetch content from a web URL", icon: "Link", category: "web", enabled: true },
  { id: "run-code", name: "Run Code", description: "Execute JavaScript code in a sandbox", icon: "Terminal", category: "code", enabled: false },
  { id: "terminal", name: "Terminal", description: "Run a shell command on the system", icon: "Shell", category: "system", enabled: false },
  { id: "train-model", name: "Train Model", description: "Start training or fine-tuning an AI model with a dataset", icon: "Brain", category: "custom", enabled: false },
  { id: "list-tools", name: "List MCP Tools", description: "List all available MCP tools and their status", icon: "Wrench", category: "system", enabled: true },
];

interface MCPPanelProps { open: boolean; onClose: () => void; }

function ToolInputForm({ toolId, onRun, onCancel, projectPath }: { toolId: string; onRun: (input: MCPFileInput) => void; onCancel: () => void; projectPath?: string }) {
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [command, setCommand] = useState("");

  const resolvePath = (p: string) => {
    if (!p) return "";
    if (p.startsWith("/") || p.includes(":\\")) return p;
    if (projectPath) return `${projectPath.replace(/\\/g, "/").replace(/\/+$/, "")}/${p}`;
    return p;
  };

  const [trainName, setTrainName] = useState("");
  const [trainMode, setTrainMode] = useState("scratch");
  const [trainDataset, setTrainDataset] = useState("builtin");
  const [trainBaseModel, setTrainBaseModel] = useState("");
  const [trainEpochs, setTrainEpochs] = useState("3");

  const run = () => {
    switch (toolId) {
      case "read-file": case "list-dir": return onRun({ path: resolvePath(path) });
      case "write-file": return onRun({ path: resolvePath(path), content });
      case "web-search": return onRun({ query });
      case "fetch-url": return onRun({ url });
      case "run-code": return onRun({ code });
      case "terminal": return onRun({ command });
      case "train-model": return onRun({ name: trainName, mode: trainMode, dataset_path: trainDataset, base_model: trainBaseModel, epochs: parseInt(trainEpochs) || 3 });
      case "list-tools": return onRun({});
      default: return onRun({});
    }
  };

  const base = (toolId === "read-file" || toolId === "write-file" || toolId === "list-dir") && projectPath;

  if (toolId === "read-file") return <div className="space-y-2">{base && <p className="text-[10px] text-muted-foreground truncate" title={projectPath}><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="file.txt or /absolute/path" className="text-xs" /><div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div></div>;
  if (toolId === "write-file") return <div className="space-y-2">{base && <p className="text-[10px] text-muted-foreground truncate" title={projectPath}><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="file.txt or /absolute/path" className="text-xs" /><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="File content..." className="w-full h-16 resize-none bg-secondary rounded-lg p-2 text-xs outline-none" /><div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div></div>;
  if (toolId === "list-dir") return <div className="space-y-2">{base && <p className="text-[10px] text-muted-foreground truncate" title={projectPath}><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="." className="text-xs" /><div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div></div>;
  if (toolId === "web-search") return <div className="space-y-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search query..." className="text-xs" /><div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div></div>;
  if (toolId === "fetch-url") return <div className="space-y-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="text-xs" /><div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div></div>;
  if (toolId === "run-code") return <div className="space-y-2"><textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="console.log('hello world');" className="w-full h-20 resize-none bg-secondary rounded-lg p-2 text-xs font-mono outline-none" /><div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div></div>;
  if (toolId === "terminal") return <div className="space-y-2">{projectPath && <p className="text-[10px] text-muted-foreground truncate" title={projectPath}><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="ls -la" className="text-xs font-mono" /><div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div></div>;
  if (toolId === "train-model") return <div className="space-y-2">
    <Input value={trainName} onChange={(e) => setTrainName(e.target.value)} placeholder="Model name" className="text-xs" />
    <select value={trainMode} onChange={(e) => setTrainMode(e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"><option value="scratch">Scratch</option><option value="lora">LoRA</option></select>
    <Input value={trainDataset} onChange={(e) => setTrainDataset(e.target.value)} placeholder="Dataset path or 'builtin'" className="text-xs" />
    {trainMode === "lora" && <Input value={trainBaseModel} onChange={(e) => setTrainBaseModel(e.target.value)} placeholder="HF model ID (e.g. Qwen/Qwen2.5-7B)" className="text-xs" />}
    <Input type="number" value={trainEpochs} onChange={(e) => setTrainEpochs(e.target.value)} placeholder="Epochs" className="text-xs" min={1} max={100} />
    <div className="flex gap-2 justify-end"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" onClick={run}><Play className="h-3 w-3 mr-1" />Run</Button></div>
  </div>;
  return null;
}

export function MCPPanel({ open, onClose }: MCPPanelProps) {
  const [tools, setTools] = useState<MCPTool[]>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : defaultTools; } catch { return defaultTools; }
  });
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [result, setResult] = useState<{ toolId: string; result: MCPResult } | null>(null);
  const [running, setRunning] = useState(false);

  const projectPath = useMemo(() => {
    const chatId = sidebarStore.getActiveChatId();
    if (!chatId) return "";
    const chat = db.getChat(chatId);
    if (!chat?.projectId) return "";
    const proj = projectService.get(chat.projectId);
    return proj?.path || "";
  }, [open]);

  const saveTools = (updated: MCPTool[]) => { setTools(updated); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); };
  const toggleTool = (id: string) => saveTools(tools.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t));

  const handleRun = async (toolId: string, input: MCPFileInput) => {
    setRunning(true);
    setResult(null);
    setActiveTool(null);
    const res = await executeMCPStep(toolId, input);
    setResult({ toolId, result: res });
    setRunning(false);
  };

  const activeCount = tools.filter((t) => t.enabled).length;
  const categories = ["all", ...new Set(tools.map((t) => t.category))];
  const filtered = tools.filter((t) => {
    if (activeCategory !== "all" && t.category !== activeCategory) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-popover border border-border rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col pointer-events-auto overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Blocks className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">MCP Tools</h2>
                    <p className="text-xs text-muted-foreground">{activeCount} of {tools.length} tools active</p>
                  </div>
                </div>
                <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
              </div>

              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools..." className="h-9 pl-9 text-sm" />
                </div>
              </div>

              <div className="flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors", activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent")}>
                    {cat === "all" ? "All" : categoryLabels[cat] || cat}
                  </button>
                ))}
              </div>

              <ScrollArea className="flex-1 h-full min-h-0">
                <div className="p-3 space-y-1">
                  {filtered.length === 0 && (
                    <div className="text-center py-8"><Wrench className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-xs text-muted-foreground">No tools found</p></div>
                  )}
                  {filtered.map((tool) => {
                    const Icon = toolIcons[tool.id] || categoryIcons[tool.category] || Wrench;
                    const isActive = activeTool === tool.id;
                    return (
                      <div key={tool.id}>
                        <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors", tool.enabled ? "bg-primary/5" : "hover:bg-accent/50")}>
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", tool.enabled ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setActiveTool(isActive ? null : tool.id)}>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{tool.name}</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{categoryLabels[tool.category] || tool.category}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                          </div>
                          <button onClick={() => toggleTool(tool.id)}
                            className={cn("h-7 px-3 rounded-lg text-xs font-medium transition-colors shrink-0", tool.enabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent")}>
                            {tool.enabled ? "Active" : "Off"}
                          </button>
                        </div>
                        {isActive && tool.enabled && (
                          <div className="ml-11 mr-3 mb-2 p-3 bg-secondary/50 rounded-xl">
                            <ToolInputForm toolId={tool.id} projectPath={projectPath} onRun={(input) => handleRun(tool.id, input)} onCancel={() => setActiveTool(null)} />
                          </div>
                        )}
                        {result && result.toolId === tool.id && (
                          <div className={cn("ml-11 mr-3 mb-2 p-3 rounded-xl text-xs", result.result.success ? "bg-green-500/5 border border-green-500/20" : "bg-destructive/5 border border-destructive/20")}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              {result.result.success ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                              <span className={result.result.success ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                                {result.result.success ? "Completed" : "Failed"}
                              </span>
                              <span className="text-muted-foreground ml-auto">{Math.round(result.result.duration)}ms</span>
                            </div>
                            <pre className="whitespace-pre-wrap break-words text-muted-foreground max-h-32 overflow-y-auto">
                              {result.result.success ? result.result.output : result.result.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {running && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                      Running...
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="px-5 py-3 border-t border-border flex items-center justify-between shrink-0">
                <p className="text-xs text-muted-foreground">Click a tool to run it</p>
                <Button size="sm" onClick={onClose}>Done</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
