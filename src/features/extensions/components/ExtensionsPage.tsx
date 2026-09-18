import { useState, useMemo } from "react";
import { Blocks, Search, Wrench, FileCode, Globe, Terminal as TerminalIcon, X, Play, FileText, FileEdit, FolderTree, Link, CheckCircle, AlertCircle, Folder, Plus, Trash2 as TrashIcon, Copy as CopyIcon, Move, Info, Search as SearchIcon, GitBranch, Monitor, ExternalLink, Code, Wand2, Database, Brain } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { executeMCPStep, getAllMCPTools, saveMCPTools, type MCPTool, type MCPResult, type MCPFileInput } from "@/services/mcp";
import { db } from "@/services/db";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { projectService } from "@/services/projects";

const toolIcons: Record<string, any> = {
  "read-file": FileText, "write-file": FileEdit, "list-dir": FolderTree,
  "web-search": Globe, "fetch-url": Link,
  "run-code": TerminalIcon, "terminal": TerminalIcon,
  "delete-file": TrashIcon, "create-directory": Folder, "copy-file": CopyIcon, "move-file": Move, "file-stat": Info, "search-files": SearchIcon,
  "git-status": GitBranch, "git-diff": GitBranch, "git-log": GitBranch, "git-commit": GitBranch,
  "system-info": Monitor, "open-in-explorer": ExternalLink, "run-python": Code, "format-code": Wand2, "summarize-file": FileText,
  "add-memory": Brain, "list-memory": Database, "search-memory": SearchIcon, "train-model": Brain,
};

const categoryIcons: Record<string, any> = { code: FileCode, web: Globe, system: TerminalIcon, custom: Wrench };
const categoryLabels: Record<string, string> = { code: "Code", web: "Web", data: "Data", system: "System", custom: "Custom" };

function ToolInputForm({ toolId, onRun, projectPath }: { toolId: string; onRun: (input: MCPFileInput) => void; projectPath?: string }) {
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [command, setCommand] = useState("");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [generic, setGeneric] = useState("{}");

  const resolvePath = (p: string) => {
    if (!p) return "";
    if (p.startsWith("/") || p.includes(":\\") || p.startsWith("browser://")) return p;
    if (projectPath) return `${projectPath.replace(/\\/g, "/").replace(/\/+$/, "")}/${p}`;
    return p;
  };

  const run = () => {
    switch (toolId) {
      case "read-file": case "list-dir": case "delete-file": case "create-directory": case "file-stat": case "summarize-file": return onRun({ path: resolvePath(path) } as any);
      case "write-file": return onRun({ path: resolvePath(path), content } as any);
      case "web-search": case "search-memory": return onRun({ query } as any);
      case "fetch-url": return onRun({ url } as any);
      case "run-code": case "run-python": return onRun({ code } as any);
      case "terminal": return onRun({ command } as any);
      case "copy-file": case "move-file": return onRun({ source: resolvePath(source), destination: resolvePath(destination) } as any);
      case "search-files": return onRun({ query, path: resolvePath(path) || "." } as any);
      case "git-status": case "git-diff": return onRun({ path: resolvePath(path) } as any);
      case "git-log": return onRun({ path: resolvePath(path), limit: 10 } as any);
      case "git-commit": return onRun({ message: content, path: resolvePath(path) } as any);
      case "open-in-explorer": return onRun({ path: resolvePath(path) } as any);
      case "format-code": return onRun({ code, language: path } as any);
      case "system-info": case "list-memory": case "list-tools": return onRun({} as any);
      default:
        try {
          const parsed = JSON.parse(generic);
          // auto resolve path fields
          if (parsed.path) parsed.path = resolvePath(parsed.path);
          if (parsed.source) parsed.source = resolvePath(parsed.source);
          if (parsed.destination) parsed.destination = resolvePath(parsed.destination);
          return onRun(parsed as any);
        } catch { return onRun({} as any); }
    }
  };

  const base = (["read-file","write-file","list-dir","delete-file","create-directory","file-stat","open-in-explorer","copy-file","move-file","search-files","git-status","git-diff","git-log","git-commit","summarize-file"].includes(toolId)) && projectPath;

  const btn = <Button size="sm" onClick={run} className="gap-1"><Play className="h-3 w-3" />Run</Button>;

  if (["read-file","list-dir","delete-file","create-directory","file-stat","summarize-file","open-in-explorer"].includes(toolId)) return <div className="space-y-2">{base && <p className="text-[10px] text-muted-foreground truncate"><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={path} onChange={(e) => setPath(e.target.value)} placeholder={toolId==="list-dir"? "." : "path/to/file or folder"} className="text-xs" />{btn}</div>;
  if (toolId === "write-file") return <div className="space-y-2">{base && <p className="text-[10px] text-muted-foreground truncate"><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="file.txt or /absolute/path" className="text-xs" /><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="File content..." className="w-full h-16 resize-none bg-secondary rounded-lg p-2 text-xs outline-none" />{btn}</div>;
  if (["web-search","search-memory"].includes(toolId)) return <div className="space-y-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search query..." className="text-xs" />{btn}</div>;
  if (toolId === "fetch-url") return <div className="space-y-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="text-xs" />{btn}</div>;
  if (["run-code","run-python"].includes(toolId)) return <div className="space-y-2"><textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder={toolId==="run-python" ? "print('hello')" : "console.log('hello world');"} className="w-full h-20 resize-none bg-secondary rounded-lg p-2 text-xs font-mono outline-none" />{btn}</div>;
  if (toolId === "terminal") return <div className="space-y-2">{projectPath && <p className="text-[10px] text-muted-foreground truncate"><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="ls -la" className="text-xs font-mono" />{btn}</div>;
  if (["copy-file","move-file"].includes(toolId)) return <div className="space-y-2">{base && <p className="text-[10px] text-muted-foreground truncate"><Folder className="h-3 w-3 inline mr-1" />{projectPath}</p>}<Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="source path" className="text-xs" /><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="destination path" className="text-xs" />{btn}</div>;
  if (toolId === "search-files") return <div className="space-y-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search term..." className="text-xs" /><Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="directory (default: .)" className="text-xs" />{btn}</div>;
  if (["git-status","git-diff","git-log"].includes(toolId)) return <div className="space-y-2"><Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="project path (empty = current)" className="text-xs" />{btn}</div>;
  if (toolId === "git-commit") return <div className="space-y-2"><Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Commit message" className="text-xs" /><Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="project path" className="text-xs" />{btn}</div>;
  if (toolId === "format-code") return <div className="space-y-2"><textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="code to format..." className="w-full h-20 resize-none bg-secondary rounded-lg p-2 text-xs font-mono outline-none" /><Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="language (js, py, etc.)" className="text-xs" />{btn}</div>;
  if (["system-info","list-memory","list-tools"].includes(toolId)) return <div className="space-y-2"><p className="text-xs text-muted-foreground">No input required</p>{btn}</div>;
  // Generic JSON for remaining tools (add-memory etc.)
  return <div className="space-y-2"><textarea value={generic} onChange={(e) => setGeneric(e.target.value)} placeholder='{"content":"..."}' className="w-full h-20 resize-none bg-secondary rounded-lg p-2 text-xs font-mono outline-none" />{btn}<p className="text-[10px] text-muted-foreground">JSON input for {toolId}</p></div>;
}

export function ExtensionsPage() {
  const [tools, setTools] = useState<MCPTool[]>(() => getAllMCPTools());
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [results, setResults] = useState<Record<string, MCPResult>>({});
  const [running, setRunning] = useState<string | null>(null);

  const projectPath = useMemo(() => {
    const chatId = sidebarStore.getActiveChatId();
    if (!chatId) return "";
    const chat = db.getChat(chatId);
    if (!chat?.projectId) return "";
    const proj = projectService.get(chat.projectId);
    return proj?.path || "";
  }, []);

  const saveTools = (updated: MCPTool[]) => { setTools(updated); saveMCPTools(updated); };
  const toggleTool = (id: string) => saveTools(tools.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t));

  const handleRun = async (toolId: string, input: MCPFileInput) => {
    setRunning(toolId);
    setResults((prev) => ({ ...prev, [toolId]: { success: true, output: "Running...", duration: 0 } }));
    const res = await executeMCPStep(toolId, input);
    setResults((prev) => ({ ...prev, [toolId]: res }));
    setRunning(null);
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
    <div className="flex-1 flex flex-col h-full">
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Blocks className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-sm font-semibold">Extensions & MCP Tools</h1>
        </div>
        <p className="text-xs text-muted-foreground">{activeCount} of {tools.length} tools active</p>
      </div>

      <div className="p-3 border-b border-border shrink-0">
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

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {filtered.length === 0 && (
            <div className="text-center py-8"><Wrench className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-xs text-muted-foreground">No tools found</p></div>
          )}
          {filtered.map((tool) => {
            const Icon = toolIcons[tool.id] || categoryIcons[tool.category] || Wrench;
            const toolResult = results[tool.id];
            return (
              <div key={tool.id}>
                <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors", tool.enabled ? "bg-primary/5" : "hover:bg-accent/50")}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", tool.enabled ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
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
                <div className="ml-11 mr-3 mb-2 p-3 bg-secondary/50 rounded-xl">
                  {tool.enabled ? (
                    <ToolInputForm toolId={tool.id} projectPath={projectPath} onRun={(input) => handleRun(tool.id, input)} />
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">Enable this tool to use it</p>
                  )}
                </div>
                {toolResult && (
                  <div className={cn("ml-11 mr-3 mb-2 p-3 rounded-xl text-xs", toolResult.success ? "bg-green-500/5 border border-green-500/20" : "bg-destructive/5 border border-destructive/20")}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {running === tool.id ? (
                        <div className="animate-spin h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full" />
                      ) : toolResult.success ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className={toolResult.success ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                        {running === tool.id ? "Running..." : toolResult.success ? "Completed" : "Failed"}
                      </span>
                      {!running && <span className="text-muted-foreground ml-auto">{Math.round(toolResult.duration)}ms</span>}
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-muted-foreground max-h-32 overflow-y-auto">
                      {toolResult.success ? toolResult.output : toolResult.error}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
