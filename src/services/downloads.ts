export interface HFModelFile {
  rfilename: string;
  size?: number;
}

export interface DownloadEntry {
  id: string;
  name: string;
  url: string;
  progress: number;
  status: "downloading" | "completed" | "error" | "cancelled";
  speed: string;
  totalSize: string;
  downloadedSize: string;
  totalBytes?: number;
  downloadedBytes?: number;
  savedPath?: string;
}

let downloads: DownloadEntry[] = [];
const listeners = new Set<() => void>();

function load() {
  try {
    const raw = localStorage.getItem("zeqouxchat-downloads");
    downloads = raw ? JSON.parse(raw) : [];
  } catch { downloads = []; }
}

function save() {
  try {
    localStorage.setItem("zeqouxchat-downloads", JSON.stringify(downloads));
  } catch {}
}

function notify() {
  listeners.forEach((l) => l());
}

function getDownloadPath(): string {
  try {
    const raw = localStorage.getItem("zeqouxchat-settings");
    if (raw) {
      const s = JSON.parse(raw);
      if (s.downloadPath) return s.downloadPath;
    }
  } catch {}
  return "";
}

load();

export const downloadService = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getDownloads: () => downloads,
  getAll: () => downloads,

  async findModelFiles(modelId: string): Promise<HFModelFile[]> {
    try {
      const res = await fetch(`https://huggingface.co/api/models/${modelId}`);
      const data = await res.json();
      const siblings: HFModelFile[] = data.siblings || [];
      const modelFiles = siblings.filter((s) => {
        const name = s.rfilename.toLowerCase();
        return name.endsWith(".gguf") || name.endsWith(".safetensors") || name.endsWith(".bin");
      });
      modelFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
      return modelFiles;
    } catch {
      return [];
    }
  },

  async startDownload(modelId: string, file?: HFModelFile) {
    let finalUrl: string;
    let name: string;
    let totalBytes = 0;

    if (file) {
      name = file.rfilename.split("/").pop() || file.rfilename;
      finalUrl = `https://huggingface.co/${modelId}/resolve/main/${file.rfilename}`;
      totalBytes = file.size || 0;
    } else {
      const files = await this.findModelFiles(modelId);
      if (files.length > 0) {
        const target = files[0];
        name = target.rfilename.split("/").pop() || target.rfilename;
        finalUrl = `https://huggingface.co/${modelId}/resolve/main/${target.rfilename}`;
        totalBytes = target.size || 0;
      } else {
        name = modelId.split("/").pop() || modelId;
        finalUrl = "";
      }
    }

    if (!finalUrl) {
      const id = crypto.randomUUID();
      const entry: DownloadEntry = {
        id, name, url: `https://huggingface.co/${modelId}`,
        progress: 0, status: "error", speed: "Failed",
        totalSize: "?", downloadedSize: "0 B", totalBytes: 0, downloadedBytes: 0,
      };
      load();
      downloads.unshift(entry);
      save();
      notify();
      return;
    }

    const id = crypto.randomUUID();
    const entry: DownloadEntry = {
      id, name, url: finalUrl,
      progress: 0, status: "downloading", speed: "Starting...",
      totalSize: totalBytes ? formatBytes(totalBytes) : "?",
      downloadedSize: "0 B", totalBytes, downloadedBytes: 0,
    };

    load();
    downloads.unshift(entry);
    save();
    notify();

    const downloadPath = getDownloadPath();
    if (totalBytes > 100 * 1024 * 1024 && !downloadPath) {
      window.open(finalUrl, "_blank");
      entry.status = "completed";
      entry.progress = 100;
      entry.speed = "Opened in browser";
      save();
      notify();
      return;
    }

    this._doDownload(entry, finalUrl).catch((err) => {
      entry.status = "error";
      entry.speed = "Failed";
      entry.totalSize = entry.downloadedSize;
      save();
      notify();
    });
  },

  async _doDownload(entry: DownloadEntry, url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentLength = entry.totalBytes || Number(response.headers.get("content-length") || "0");
    if (contentLength === 0) throw new Error("Empty response");
    if (contentLength < 1024) throw new Error(`File too small (${contentLength} bytes). Check if the URL is correct.`);

    entry.totalBytes = contentLength;
    entry.totalSize = formatBytes(contentLength);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const chunks: Uint8Array[] = [];
    let downloaded = 0;
    const startTime = Date.now();
    let lastUpdate = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloaded += value.length;
      entry.downloadedBytes = downloaded;
      entry.downloadedSize = formatBytes(downloaded);

      if (contentLength > 0) {
        entry.progress = Math.round((downloaded / contentLength) * 100);
      }

      const now = Date.now();
      if (now - lastUpdate > 300) {
        const elapsed = (now - startTime) / 1000;
        const bytesPerSec = downloaded / elapsed;
        entry.speed = `${formatBytes(bytesPerSec)}/s`;
        lastUpdate = now;
        save();
        notify();
      }
    }

    // Try to save to download path (Tauri) or fallback to browser download
    const downloadPath = getDownloadPath();
    const fullPath = downloadPath ? `${downloadPath.replace(/\\/g, "/").replace(/\/+$/, "")}/${entry.name}` : "";
    let savedViaTauri = false;

    if (fullPath) {
      try {
        const { writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
        const uint8 = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
        let offset = 0;
        for (const c of chunks) { uint8.set(c, offset); offset += c.length; }
        await writeFile(fullPath, uint8);
        entry.savedPath = fullPath;
        savedViaTauri = true;
      } catch {}
    }

    if (!savedViaTauri) {
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }

    entry.status = "completed";
    entry.progress = 100;
    entry.speed = savedViaTauri ? `Saved to ${entry.savedPath}` : "Completed";
    entry.downloadedSize = formatBytes(downloaded);
    save();
    notify();
  },

  cancel(id: string) {
    const entry = downloads.find((d) => d.id === id);
    if (entry) {
      entry.status = "cancelled";
      save();
      notify();
    }
  },

  clear() {
    downloads = [];
    save();
    notify();
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
