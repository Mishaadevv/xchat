import { useState, useRef, useEffect, useMemo } from "react";
import { PanelRightOpen, Lock, Unlock, ChevronDown, Search, Folder, FolderOpen, Plus, Trash2, Check, ExternalLink, Copy } from "lucide-react";
import { useStore } from "@/lib/useStore";
import { cn } from "@/lib/utils";
import { appStore } from "@/app/store/appStore";
import { chatStore } from "../store/chatStore";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { providerService } from "@/services/providers";
import { projectService } from "@/services/projects";
import { db } from "@/services/db";
import { i18n } from "@/services/i18n";
import { setBrowserDirHandle } from "@/services/mcp";

// ── Context window indicator ────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function ContextIndicator({ used, total, percentage }: { used: number; total: number; percentage: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on usage
  let strokeColor = "#22c55e"; // green < 50%
  if (percentage > 75) strokeColor = "#ef4444"; // red > 75%
  else if (percentage > 50) strokeColor = "#f59e0b"; // amber > 50%

  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <svg width="18" height="18" viewBox="0 0 18 18" className="cursor-default">
        {/* Background circle */}
        <circle cx="9" cy="9" r={radius} fill="none" stroke="currentColor" strokeWidth="1.5"
          className="text-zinc-200 dark:text-zinc-700" />
        {/* Progress arc */}
        <circle cx="9" cy="9" r={radius} fill="none" stroke={strokeColor} strokeWidth="1.5"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 9 9)" className="transition-all duration-500" />
        {/* Center dot */}
        <circle cx="9" cy="9" r="1.5" fill={strokeColor} />
      </svg>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-zinc-900 dark:bg-zinc-800 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
            <div className="font-semibold mb-1">Context Window</div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Used:</span>
              <span className="font-mono">{formatTokens(used)}</span>
              <span className="text-zinc-500">/</span>
              <span className="font-mono">{formatTokens(total)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-zinc-400">Load:</span>
              <span className="font-mono" style={{ color: strokeColor }}>{percentage}%</span>
            </div>
            {/* Arrow */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 dark:bg-zinc-800 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatHeader() {
  const { messages, model, provider } = useStore(chatStore.subscribe, chatStore.getState);
  const { rightPanelOpen } = useStore(appStore.subscribe, appStore.getState);
  const { activeChatId, chats } = useStore(sidebarStore.subscribe, sidebarStore.getState);
  const activeChat = chats.find((c) => c.id === activeChatId);
  const [showModels, setShowModels] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Project popover state
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Drag & drop state
  const [dragOver, setDragOver] = useState(false);
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;

  const providers = providerService.getProviders();
  const activeProvider = providers.find((p) => p.id === provider);
  const currentProject = activeChat?.projectId ? projectService.get(activeChat.projectId) : null;
  const allProjects = projectService.getAll();

  // Context window usage — read from ChatMessages (includes streaming content)
  const [contextUsage, setContextUsage] = useState<{ used: number; total: number; percentage: number } | null>(null);
  useEffect(() => {
    const check = () => {
      const ctx = (window as any).__zeqoux_context;
      setContextUsage(ctx || null);
    };
    check();
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    // Restore browser handle from IndexedDB (survives reload)
    import("@/services/mcp").then(m => (m as any).initBrowserHandle?.()).catch(() => {});
    // Listen for Tauri drag-drop events (gives full paths)
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const off = await getCurrentWindow().onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setDragOver(true);
          } else if (event.payload.type === "leave") {
            setDragOver(false);
          } else if (event.payload.type === "drop") {
            setDragOver(false);
            const paths = event.payload.paths;
            const chatId = activeChatIdRef.current;
            if (paths.length > 0 && chatId) {
              const path = paths[0];
              const name = path.split("\\").pop()?.split("/").pop() || "Project";
              const project = projectService.add(name, path);
              db.updateChat(chatId, { projectId: project.id });
              sidebarStore.refreshChats();
            }
          }
        });
        if (cancelled) {
          off();
        } else {
          unlisten = off;
        }
      } catch {
        // Tauri API not available (browser dev)
      }
    })();
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, []); // Only register once

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModels(false);
        setModelSearch("");
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (showModels && searchRef.current) searchRef.current.focus();
  }, [showModels]);

  if (!activeChatId) return null;

  const canChangeModel = messages.length === 0;

  const modelItems = providers
    .filter((p) => p.models.length > 0)
    .flatMap((p) => p.models.map((m) => ({ model: m, provider: p })))
    .filter((item) => {
      if (!modelSearch) return true;
      const q = modelSearch.toLowerCase();
      return item.model.toLowerCase().includes(q) || item.provider.name.toLowerCase().includes(q);
    });

  const handleSelectProject = async () => {
    // Try Tauri dialog first
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false, title: i18n.t("project.select") });
      if (selected && activeChatId) {
        const path = selected as string;
        const name = path.split("\\").pop()?.split("/").pop() || "Project";
        const project = projectService.add(name, path);
        db.updateChat(activeChatId, { projectId: project.id });
        sidebarStore.refreshChats();
        setShowProjectMenu(false);
        return;
      }
    } catch {}
    // Browser fallback: File System Access API
    try {
      const anyWindow: any = window as any;
      if (anyWindow.showDirectoryPicker) {
        const handle = await anyWindow.showDirectoryPicker({ mode: "readwrite" });
        if (handle && activeChatId) {
          setBrowserDirHandle(handle);
          const name = handle.name || "Project";
          const browserPath = `browser://${name}`;
          const project = projectService.add(name, browserPath);
          // store handle already via setBrowserDirHandle
          db.updateChat(activeChatId, { projectId: project.id });
          sidebarStore.refreshChats();
        }
      } else {
        // fallback to input webkitdirectory
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true as any;
        input.onchange = () => {
          const files = input.files;
          if (files && files.length > 0 && activeChatId) {
            const first = files[0] as any;
            const rel = first.webkitRelativePath || first.name;
            const name = rel.split("/")[0] || "Project";
            const browserPath = `browser://${name}`;
            // No handle, but create virtual project for download fallback
            const project = projectService.add(name, browserPath);
            db.updateChat(activeChatId, { projectId: project.id });
            sidebarStore.refreshChats();
          }
        };
        input.click();
      }
    } catch (e) {
      console.warn("Project picker failed", e);
    }
    setShowProjectMenu(false);
  };

  const handleSelectExisting = (projectId: string) => {
    if (activeChatId) {
      db.updateChat(activeChatId, { projectId });
      sidebarStore.refreshChats();
    }
    setShowProjectMenu(false);
  };

  const handleRemoveProject = () => {
    if (activeChatId) {
      db.updateChat(activeChatId, { projectId: "" });
      sidebarStore.refreshChats();
    }
    setShowProjectMenu(false);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    projectService.remove(projectId);
    if (activeChat?.projectId === projectId && activeChatId) {
      db.updateChat(activeChatId, { projectId: "" });
    }
    sidebarStore.refreshChats();
  };

  const openProjectFolder = async (path: string) => {
    try {
      // Tauri opener
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
    } catch {
      // browser fallback: copy to clipboard
      try { await navigator.clipboard.writeText(path); } catch {}
    }
  };

  const copyProjectPath = async (path: string) => {
    try { await navigator.clipboard.writeText(path); } catch {}
  };

  // Browser native drag-drop for folder
  const handleBrowserDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleBrowserDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleBrowserDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const chatId = activeChatIdRef.current;
    if (!chatId) return;
    // Try File System Access via getAsFileSystemHandle (Chrome/Edge)
    const items = Array.from(e.dataTransfer.items as any) as any[];
    for (const item of items) {
      try {
        if (item.getAsFileSystemHandle) {
          const handle = await item.getAsFileSystemHandle();
          if (handle && handle.kind === "directory") {
            setBrowserDirHandle(handle);
            const name = handle.name || "Project";
            const browserPath = `browser://${name}`;
            const project = projectService.add(name, browserPath);
            db.updateChat(chatId, { projectId: project.id });
            sidebarStore.refreshChats();
            return;
          }
        }
      } catch {}
    }
    // Fallback: webkitGetAsEntry (older)
    const entries = Array.from(e.dataTransfer.items).map((it: any) => it.webkitGetAsEntry?.()).filter(Boolean) as any[];
    for (const entry of entries) {
      if (entry && entry.isDirectory) {
        const name = entry.name || "Project";
        const browserPath = `browser://${name}`;
        const project = projectService.add(name, browserPath);
        db.updateChat(chatId, { projectId: project.id });
        sidebarStore.refreshChats();
        return;
      }
    }
    // Fallback: files with webkitRelativePath? can't get dir, just create virtual
    if (e.dataTransfer.files.length > 0) {
      const first: any = e.dataTransfer.files[0];
      const rel = first.webkitRelativePath || first.name;
      const name = rel.split("/")[0] || "Project";
      const project = projectService.add(name, `browser://${name}`);
      db.updateChat(chatId, { projectId: project.id });
      sidebarStore.refreshChats();
    }
  };

  return (
    <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {activeChat && (
          <span className="text-sm font-medium truncate max-w-[200px]">{activeChat.title}</span>
        )}

        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => canChangeModel ? setShowModels(!showModels) : null}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-muted-foreground select-none",
              canChangeModel && "hover:bg-accent cursor-pointer"
            )}
          >
            {messages.length > 0 ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 text-green-500" />}
            <span className="font-medium text-foreground truncate max-w-[150px]" title={model}>
              {model || (modelItems.length > 0 ? "Select model" : "No models")}
            </span>
            {activeProvider && model && (
              <>
                <span className="text-border">|</span>
                <span>{activeProvider.name}</span>
              </>
            )}
            {contextUsage && (
              <ContextIndicator used={contextUsage.used} total={contextUsage.total} percentage={contextUsage.percentage} />
            )}
            {canChangeModel && <ChevronDown className="h-3 w-3" />}
          </button>

          {showModels && canChangeModel && (
            <div className="absolute top-full mt-1 left-0 w-72 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Search models..."
                    className="w-full h-8 pl-8 pr-3 bg-secondary rounded-md text-xs outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {modelItems.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                    {modelSearch ? "No models match" : "No models available. Add API keys in Settings."}
                  </p>
                ) : (
                  modelItems.map(({ model: m, provider: p }) => (
                    <button
                      key={`${p.id}-${m}`}
                      onClick={() => {
                        chatStore.setProvider(p.id);
                        chatStore.setModel(m);
                        localStorage.setItem("zeqouxchat-last-model", JSON.stringify({ model: m, provider: p.id }));
                        setShowModels(false);
                        setModelSearch("");
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                        model === m && provider === p.id ? "bg-accent font-medium" : "hover:bg-accent/50"
                      )}
                    >
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0 w-12 text-center truncate">
                        {p.name}
                      </span>
                      <span className="truncate">{m}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          ref={projectMenuRef}
          className="relative"
          onDragOver={handleBrowserDragOver}
          onDragLeave={handleBrowserDragLeave}
          onDrop={handleBrowserDrop}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className={cn(
                "flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-xl border transition-all",
                currentProject
                  ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700"
                  : "bg-secondary/50 border-transparent hover:bg-accent text-muted-foreground",
                dragOver && "ring-2 ring-primary bg-primary/10 border-primary"
              )}
              title={currentProject ? currentProject.path : i18n.t("chat.no_project")}
            >
              {dragOver ? (
                <>
                  <Folder className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-600 font-medium">Drop folder here</span>
                </>
              ) : currentProject ? (
                <>
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Folder className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex flex-col items-start min-w-0 text-left">
                    <span className="font-medium text-foreground truncate max-w-[160px] leading-none">{currentProject.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px] leading-none mt-0.5 font-mono" title={currentProject.path}>{currentProject.path}</span>
                  </div>
                </>
              ) : (
                <>
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>{i18n.t("chat.no_project")}</span>
                </>
              )}
            </button>
            {currentProject && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => copyProjectPath(currentProject.path)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy path"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  onClick={() => openProjectFolder(currentProject.path)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Open in file manager"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {showProjectMenu && (
            <div className="absolute top-full mt-1 right-0 w-64 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-2 border-b border-border">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {i18n.t("project.select")}
                </p>
              </div>
              <div className="py-1">
                {/* Browse for project folder */}
                <button
                  onClick={handleSelectProject}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <Folder className="h-4 w-4 text-primary" />
                  <span>{i18n.t("project.select")}</span>
                </button>

                {/* Existing projects list */}
                {allProjects.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-[10px] text-muted-foreground">
                      Recent projects
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {allProjects.map((p) => (
                        <div key={p.id} className="flex items-center">
                          <button
                            onClick={() => handleSelectExisting(p.id)}
                            className="flex-1 flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent text-left min-w-0"
                          >
                            <Folder className={cn(
                              "h-4 w-4 shrink-0",
                              currentProject?.id === p.id ? "text-primary" : "text-muted-foreground"
                            )} />
                            <div className="min-w-0 flex-1">
                              <span className="truncate block">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground truncate block">{p.path}</span>
                            </div>
                            {currentProject?.id === p.id && (
                              <Check className="h-3 w-3 text-primary shrink-0" />
                            )}
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(e, p.id)}
                            className="h-8 w-8 flex items-center justify-center shrink-0 opacity-0 hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            title={i18n.t("project.remove")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Current project actions */}
                {currentProject && (
                  <>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={handleRemoveProject}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent text-muted-foreground"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">{i18n.t("project.remove")}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => appStore.toggleRightPanel()}
          className={cn(
            "h-8 w-8 flex items-center justify-center rounded-md transition-colors shrink-0",
            rightPanelOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
