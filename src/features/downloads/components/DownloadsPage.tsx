import { useState, useEffect } from "react";
import { Download, X, RefreshCw, Trash2, Folder, FolderOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { downloadService, type DownloadEntry } from "@/services/downloads";
import { settingsStore } from "@/services/settingsStore";
import { cn } from "@/lib/utils";

export function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [downloadPath, setDownloadPathState] = useState(settingsStore.getDownloadPath());

  useEffect(() => {
    setDownloads(downloadService.getAll());
    const unsub = downloadService.subscribe(() => setDownloads(downloadService.getAll()));
    return () => { unsub(); };
  }, []);

  const clearCompleted = () => {
    downloadService.clear();
  };

  const cancelItem = (id: string) => {
    downloadService.cancel(id);
  };

  const pickDownloadFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false, title: "Select download folder" });
      if (selected) {
        settingsStore.setDownloadPath(selected as string);
        setDownloadPathState(selected as string);
      }
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
        <h1 className="text-sm font-semibold">Downloads</h1>
        <div className="flex items-center gap-2">
          <button onClick={pickDownloadFolder} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent transition-colors">
            <Folder className="h-3.5 w-3.5" />
            {downloadPath ? downloadPath.split("\\").pop()?.split("/").pop() || "Change folder" : "Set folder"}
          </button>
          {downloads.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCompleted}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
            </Button>
          )}
        </div>
      </div>

      {downloadPath && (
        <div className="px-6 py-2 border-b border-border/50 flex items-center gap-2 text-[11px] text-muted-foreground bg-secondary/20">
          <FolderOpen className="h-3 w-3" />
          <span className="truncate" title={downloadPath}>{downloadPath}</span>
          <button onClick={() => { settingsStore.setDownloadPath(""); setDownloadPathState(""); }} className="text-destructive hover:underline ml-auto">Clear</button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-[600px] mx-auto space-y-3">
          {downloads.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <Download className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No downloads yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Downloads from the Hub will appear here
              </p>
            </div>
          ) : (
            downloads.map((dl) => (
              <div key={dl.id} className="border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      {dl.status === "completed" ? (
                        <Download className="h-4 w-4 text-green-500" />
                      ) : dl.status === "error" || dl.status === "cancelled" ? (
                        <X className="h-4 w-4 text-destructive" />
                      ) : (
                        <RefreshCw className={cn("h-4 w-4", dl.status === "downloading" && "animate-spin")} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{dl.name}</p>
                      <p className="text-xs text-muted-foreground">{dl.totalSize}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {dl.status === "downloading" && (
                      <Button variant="ghost" size="icon-sm" onClick={() => cancelItem(dl.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {(dl.status === "completed" || dl.status === "error" || dl.status === "cancelled") && (
                      <Button variant="ghost" size="icon-sm" onClick={() => cancelItem(dl.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      dl.status === "completed" ? "bg-green-500" : dl.status === "error" || dl.status === "cancelled" ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${dl.progress}%` }}
                  />
                </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {dl.status === "downloading" ? dl.speed : dl.status === "completed" ? (dl.savedPath ? "Saved" : "Completed") : dl.status === "error" ? "Failed" : dl.status === "cancelled" ? "Cancelled" : ""}
                  </span>
                  <span>
                    {dl.status === "completed" ? `${dl.totalSize}` : `${dl.downloadedSize} / ${dl.totalSize}`}
                  </span>
                </div>
                {dl.savedPath && (
                  <p className="text-[10px] text-muted-foreground truncate mt-1" title={dl.savedPath}>
                    <Folder className="h-3 w-3 inline mr-1" />{dl.savedPath}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
