import { useState, useEffect } from "react";
import { Folder, Plus, Trash2, FolderOpen, ExternalLink, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectService } from "@/services/projects";
import { providerService } from "@/services/providers";
import { sidebarStore } from "@/features/sidebar/store/sidebarStore";
import { useStore } from "@/lib/useStore";
import { db } from "@/services/db";
import { i18n } from "@/services/i18n";
import { cn } from "@/lib/utils";
export function ProjectsPage() {
  const [projects, setProjects] = useState(projectService.getAll());
  const [projectChatCounts, setProjectChatCounts] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");

  const { chats } = useStore(sidebarStore.subscribe, sidebarStore.getState);

  useEffect(() => {
    const update = () => setProjects(projectService.getAll());
    update();
    const unsubs = [
      sidebarStore.subscribe(update),
      providerService.subscribe(update),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const chat of chats) {
      if (chat.projectId) {
        counts[chat.projectId] = (counts[chat.projectId] || 0) + 1;
      }
    }
    setProjectChatCounts(counts);
  }, [chats]);

  const handleAddProject = async () => {
    setError("");
    if (!newPath.trim()) { setError("Enter a project path"); return; }
    try {
      const name = newName.trim() || newPath.trim().split("\\").pop()?.split("/").pop() || "Project";
      projectService.add(name, newPath.trim());
      setNewName("");
      setNewPath("");
      setAdding(false);
      setProjects(projectService.getAll());
    } catch (e: any) {
      setError(e.message || "Failed to add project");
    }
  };

  const handlePickFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false, title: i18n.t("project.select") });
      if (selected) {
        const path = selected as string;
        const name = newName.trim() || path.split("\\").pop()?.split("/").pop() || "Project";
        projectService.add(name, path);
        setNewName("");
        setAdding(false);
        setProjects(projectService.getAll());
      }
    } catch {}
  };

  const handleRemove = (id: string) => {
    for (const chat of chats) {
      if (chat.projectId === id) {
        db.updateChat(chat.id, { projectId: "" });
      }
    }
    projectService.remove(id);
    setProjects(projectService.getAll());
    sidebarStore.refreshChats();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
        <h1 className="text-sm font-semibold">{i18n.t("nav.projects") || "Projects"}</h1>
        <Button size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {i18n.t("project.add") || "Add Project"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl mx-auto">
          {adding && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{i18n.t("project.add") || "Add Project"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={i18n.t("project.name_placeholder") || "Project name (optional)"}
                />
                <div className="flex gap-2">
                  <Input
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder={i18n.t("project.path_placeholder") || "C:\\Users\\...\\my-project"}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={handlePickFolder}>
                    <Folder className="h-3.5 w-3.5 mr-1" />
                    {i18n.t("project.browse") || "Browse"}
                  </Button>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddProject}>
                    {i18n.t("project.add") || "Add"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setError(""); }}>
                    {i18n.t("settings.cancel")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {projects.length === 0 ? (
            <div className="text-center py-20">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h2 className="text-base font-medium text-muted-foreground mb-2">
                {i18n.t("project.no_projects") || "No projects yet"}
              </h2>
              <p className="text-sm text-muted-foreground/60 mb-6">
                {i18n.t("project.no_projects_hint") || "Add a project to give AI context about your codebase"}
              </p>
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {i18n.t("project.add") || "Add Project"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const chatCount = projectChatCounts[p.id] || 0;
                return (
                  <Card key={p.id} className="hover:shadow-sm transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Folder className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate max-w-[150px]" title={p.name}>{p.name}</span>
                        </CardTitle>
                        <button
                          onClick={() => handleRemove(p.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md opacity-0 hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground truncate mb-2" title={p.path}>
                        {p.path}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded",
                          chatCount > 0 ? "bg-primary/10 text-primary" : "bg-secondary"
                        )}>
                          {chatCount} chat{chatCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}