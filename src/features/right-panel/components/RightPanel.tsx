import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Cpu, BarChart3, ScrollText, BookOpen, Wifi, FolderOpen, Folder, Trash2, RefreshCw, CheckCircle2, Circle, Plus } from "lucide-react";
import { useStore } from "@/lib/useStore";
import { appStore } from "@/app/store/appStore";
import { chatStore } from "@/features/chat/store/chatStore";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { db } from "@/services/db";
import { providerService } from "@/services/providers";
import { projectService } from "@/services/projects";
import { scanProjectTree, flattenFileList, type FileEntry } from "@/services/project-scanner";
import { taskService, type Task } from "@/services/tasks";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getEnabledTools } from "@/services/mcp";
import { cn } from "@/lib/utils";
import { getUnifiedContextUsage } from "@/services/contextWindow";

const sections = [
  { id: "tasks", icon: CheckCircle2, label: "Tasks" },
  { id: "files", icon: FolderOpen, label: "Project Files" },
  { id: "info", icon: FileText, label: "Chat Info" },
  { id: "model", icon: Cpu, label: "Model Info" },
  { id: "context", icon: BarChart3, label: "Context Usage" },
  { id: "system", icon: BookOpen, label: "System Prompt" },
];

export function RightPanel() {
  const { rightPanelOpen } = useStore(appStore.subscribe, appStore.getState);
  const { messages, model, provider, temperature, systemPrompt, maxContextTokens, internetMode, thinkingMode, isStreaming, streamingContent } = useStore(chatStore.subscribe, chatStore.getState);
  const { activeChatId, chats } = useStore(sidebarStore.subscribe, sidebarStore.getState);
  const activeChat = chats.find((c) => c.id === activeChatId);
  const [activeSection, setActiveSection] = useState("info");
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(systemPrompt);
  const [projectFiles, setProjectFiles] = useState<FileEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showPathInput, setShowPathInput] = useState(false);
  const [manualPath, setManualPath] = useState("");

  useEffect(() => {
    if (activeChatId) {
      setTasks(taskService.getAll(activeChatId));
    } else {
      setTasks([]);
    }
  }, [activeChatId, messages]);

  const providers = providerService.getProviders();
  const activeProvider = providers.find((p) => p.id === provider);
  const enabledTools = getEnabledTools();
  const currentProject = activeChat?.projectId ? projectService.get(activeChat.projectId) : null;

  // Same live source as the header ring: server-reported tokens when the
  // server gives them, live estimate otherwise, streaming text included.
  const unifiedContext = useMemo(
    () => getUnifiedContextUsage(model, messages, isStreaming ? streamingContent : "", maxContextTokens),
    [model, messages, isStreaming, streamingContent, maxContextTokens],
  );
  const totalTokens = unifiedContext.used;
  const maxContext = unifiedContext.total;
  const contextPct = unifiedContext.percentage;

  const savePrompt = () => {
    chatStore.setSystemPrompt(promptDraft);
    setEditingPrompt(false);
  };

  const pickFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false, title: "Select project folder" });
      if (selected && activeChatId) {
        const name = (selected as string).split("\\").pop()?.split("/").pop() || "Project";
        const project = projectService.add(name, selected as string);
        db.updateChat(activeChatId, { projectId: project.id });
        const updated = chats.find((c) => c.id === activeChatId);
        if (updated) {
          sidebarStore.refreshChats();
        }
      }
    } catch {}
  };

  const removeProject = () => {
    if (activeChatId && activeChat?.projectId) {
      db.updateChat(activeChatId, { projectId: "" });
      projectService.remove(activeChat.projectId);
    }
  };

  const setProjectFromPath = (path: string) => {
    if (!path.trim() || !activeChatId) return;
    const name = path.trim().split("\\").pop()?.split("/").pop() || "Project";
    const project = projectService.add(name, path.trim());
    db.updateChat(activeChatId, { projectId: project.id });
    sidebarStore.refreshChats();
    setShowPathInput(false);
    setManualPath("");
  };

  useEffect(() => {
    if (activeSection === "files" && currentProject) {
      refreshFileList(currentProject.path);
    }
  }, [activeSection, currentProject]);

  const refreshFileList = async (dirPath: string) => {
    setScanning(true);
    try {
      const tree = await scanProjectTree(dirPath);
      setProjectFiles(tree);
    } catch {
      setProjectFiles([]);
    }
    setScanning(false);
  };

  return (
    <AnimatePresence>
      {rightPanelOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="h-full border-l bg-background flex flex-col shrink-0 overflow-hidden"
        >
          <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
            <span className="text-sm font-medium">Context</span>
            <button onClick={() => appStore.setRightPanelOpen(false)}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {sections.map((section) => (
                <button key={section.id} onClick={() => setActiveSection(section.id)}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    activeSection === section.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
                  <section.icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </button>
              ))}
            </div>

            <Separator className="my-3" />

            <div className="px-4 pb-4 space-y-4">
              {activeSection === "tasks" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">Tasks</p>
                  <div className="flex gap-2 mb-3">
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTaskTitle.trim() && activeChatId) {
                          taskService.add(activeChatId, newTaskTitle.trim());
                          setTasks(taskService.getAll(activeChatId));
                          setNewTaskTitle("");
                        }
                      }}
                      placeholder="Add a task..."
                      className="flex-1 h-8 px-3 bg-secondary rounded-lg text-xs outline-none placeholder:text-muted-foreground/60"
                    />
                    <button onClick={() => {
                      if (newTaskTitle.trim() && activeChatId) {
                        taskService.add(activeChatId, newTaskTitle.trim());
                        setTasks(taskService.getAll(activeChatId));
                        setNewTaskTitle("");
                      }
                    }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {tasks.length === 0 ? (
                    <div className="bg-secondary/50 rounded-lg p-4 text-center">
                      <CheckCircle2 className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">No tasks yet</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ask AI to create tasks with `- [ ] task`</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {tasks.map((task) => (
                        <div key={task.id}
                          className={cn(
                            "flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors",
                            task.done ? "bg-green-500/5" : "hover:bg-accent/50"
                          )}>
                          <button onClick={() => { taskService.toggle(task.id); setTasks(taskService.getAll(activeChatId)); }}
                            className="mt-0.5 shrink-0">
                            {task.done
                              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                              : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs", task.done && "line-through text-muted-foreground")}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>
                            )}
                          </div>
                          <button onClick={() => { taskService.remove(task.id); setTasks(taskService.getAll(activeChatId)); }}
                            className="opacity-0 hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeSection === "files" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">Project Directory</p>

                  {projectService.getAll().length > 0 && !currentProject && (
                    <div className="mb-3">
                      <p className="text-[10px] text-muted-foreground mb-1.5">Existing projects</p>
                      <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                        {projectService.getAll().map((p) => (
                          <button key={p.id} onClick={() => { if (activeChatId) { db.updateChat(activeChatId, { projectId: p.id }); sidebarStore.refreshChats(); } }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-xs text-left transition-colors">
                            <Folder className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate">{p.name}</span>
                            <span className="text-muted-foreground ml-auto text-[10px] truncate max-w-[80px]">{p.path.split("\\").pop()?.split("/").pop()}</span>
                          </button>
                        ))}
                      </div>
                      <Separator className="my-2" />
                    </div>
                  )}

                  {currentProject ? (
                    <div className="space-y-3">
                      {showPathInput ? (
                        <div className="space-y-2">
                          <input
                            autoFocus
                            value={manualPath || currentProject.path}
                            onChange={(e) => setManualPath(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") setProjectFromPath(manualPath); if (e.key === "Escape") { setShowPathInput(false); setManualPath(""); } }}
                            placeholder="C:\Users\...\my-project"
                            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border outline-none focus:border-primary transition-colors"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => { const path = manualPath || currentProject.path; setProjectFromPath(path); }}
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground transition-colors">
                              Update Path
                            </button>
                            <button onClick={() => { setShowPathInput(false); setManualPath(""); }}
                              className="px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-accent text-muted-foreground transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bg-secondary/50 rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="text-sm font-medium truncate">{currentProject.name}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate" title={currentProject.path}>{currentProject.path}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={pickFolder}
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-accent text-muted-foreground transition-colors">
                              Change
                            </button>
                            <button onClick={removeProject}
                              className="px-3 py-1.5 text-xs rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                            <button onClick={() => refreshFileList(currentProject.path)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-accent text-muted-foreground transition-colors">
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          </div>

                          {projectService.getAll().length > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1">Switch project</p>
                              <div className="space-y-0.5 max-h-[100px] overflow-y-auto">
                                {projectService.getAll().filter((p) => p.id !== currentProject.id).map((p) => (
                                  <button key={p.id} onClick={() => { if (activeChatId) { db.updateChat(activeChatId, { projectId: p.id }); sidebarStore.refreshChats(); } }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-xs text-left transition-colors">
                                    <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="truncate">{p.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {scanning ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Scanning project...</span>
                            </div>
                          ) : projectFiles.length > 0 ? (
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1.5">Files ({countFiles(projectFiles)})</p>
                              <div className="max-h-48 overflow-y-auto space-y-0.5 text-[11px] font-mono">
                                {renderFileTree(projectFiles)}
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-secondary/50 rounded-lg p-4 text-center">
                        <FolderOpen className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-xs text-muted-foreground">No project folder set</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">MCP file tools will use this as root</p>
                      </div>
                      {showPathInput ? (
                        <div className="space-y-2">
                          <input
                            autoFocus
                            value={manualPath}
                            onChange={(e) => setManualPath(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") setProjectFromPath(manualPath); if (e.key === "Escape") setShowPathInput(false); }}
                            placeholder="C:\Users\...\my-project"
                            className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border outline-none focus:border-primary transition-colors"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setProjectFromPath(manualPath)}
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground transition-colors">
                              Set Path
                            </button>
                            <button onClick={() => setShowPathInput(false)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-accent text-muted-foreground transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={pickFolder}
                            className="flex-1 px-3 py-2 text-xs rounded-lg bg-primary text-primary-foreground transition-colors">
                            Browse...
                          </button>
                          <button onClick={() => setShowPathInput(true)}
                            className="flex-1 px-3 py-2 text-xs rounded-lg bg-secondary hover:bg-accent text-muted-foreground transition-colors">
                            Type Path
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeSection === "info" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">Chat Info</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium truncate max-w-[160px]">{activeChat?.title || "Untitled"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Messages</span>
                      <span className="font-medium">{messages.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Temperature</span>
                      <span className="font-medium">{temperature.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Search</span>
                      <div className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full", internetMode ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                        <Wifi className="h-3 w-3" /> {internetMode ? "On" : "Off"}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Thinking</span>
                      <div className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full", thinkingMode ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                        <span className="text-[10px] font-mono">T?</span> {thinkingMode ? "On" : "Off"}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground">MCP Tools</span>
                      <div className="text-right">
                        <span className="font-medium">{enabledTools.length} active</span>
                        {enabledTools.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 justify-end">
                            {enabledTools.map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "model" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">Model Info</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-medium truncate max-w-[180px] text-right">{model || "Not selected"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider</span>
                      <span>{activeProvider?.name || provider || "None"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{activeProvider?.type || "openai"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base URL</span>
                      <span className="text-xs truncate max-w-[160px] text-right">{activeProvider?.baseUrl || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">API Key</span>
                      <span>{activeProvider?.apiKey ? "Configured" : "None"}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "context" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">Token Usage</p>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Used</span>
                        <span className="font-medium tabular-nums">
                          {totalTokens.toLocaleString()} / {maxContext.toLocaleString()}
                          {unifiedContext.source === "server" ? " · exact" : " · est"}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", contextPct > 80 ? "bg-amber-500" : contextPct > 95 ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${contextPct}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">User</p>
                        <p className="text-sm font-medium tabular-nums">{messages.filter((m) => m.role === "user").length}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">Assistant</p>
                        <p className="text-sm font-medium tabular-nums">{messages.filter((m) => m.role === "assistant").length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "system" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">System Prompt</p>
                  {editingPrompt ? (
                    <div className="space-y-2">
                      <textarea
                        value={promptDraft}
                        onChange={(e) => setPromptDraft(e.target.value)}
                        className="w-full h-32 resize-none bg-secondary rounded-lg p-3 text-xs outline-none leading-relaxed"
                        placeholder="Enter system prompt..."
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditingPrompt(false); setPromptDraft(systemPrompt); }}
                          className="px-3 py-1.5 text-xs rounded-lg hover:bg-accent text-muted-foreground transition-colors">Cancel</button>
                        <button onClick={savePrompt}
                          className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground transition-colors">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {systemPrompt || "No system prompt set"}
                      </div>
                      <button onClick={() => { setEditingPrompt(true); setPromptDraft(systemPrompt); }}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-accent text-muted-foreground transition-colors">
                        Edit System Prompt
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function countFiles(entries: FileEntry[]): number {
  let count = 0;
  for (const e of entries) {
    if (!e.isDir) count++;
    if (e.children) count += countFiles(e.children);
  }
  return count;
}

function renderFileTree(entries: FileEntry[], depth = 0): React.ReactNode {
  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((entry) => {
    const indent = depth * 12;
    const key = entry.path || entry.name;
    return (
      <div key={key}>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-accent/50 cursor-default"
          style={{ paddingLeft: `${8 + indent}px` }}
          title={entry.path}
        >
          {entry.isDir
            ? <Folder className="h-3 w-3 text-amber-500 shrink-0" />
            : <FileText className="h-3 w-3 text-sky-500 shrink-0" />
          }
          <span className="truncate">{entry.name}</span>
          {entry.size != null && !entry.isDir && (
            <span className="text-muted-foreground ml-auto shrink-0 text-[10px] tabular-nums">
              {formatSize(entry.size)}
            </span>
          )}
        </div>
        {entry.children && entry.children.length > 0 && (
          <div>{renderFileTree(entry.children, depth + 1)}</div>
        )}
      </div>
    );
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

