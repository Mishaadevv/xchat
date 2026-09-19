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
  /** For smart (catalog) downloads — enables Retry. */
  repo?: string;
  catalogId?: string;
  preferredFile?: string;
}

let downloads: DownloadEntry[] = [];
const listeners = new Set<() => void>();
const aborters = new Map<string, AbortController>();

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
  getDownloads: () => [...downloads],
  getAll: () => [...downloads],

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
      // Honest state: nothing was downloaded in-app, the browser took over.
      entry.status = "completed";
      entry.progress = 0;
      entry.speed = "Opened in browser";
      save();
      notify();
      return;
    }

    const ctrl = new AbortController();
    aborters.set(id, ctrl);
    this._doDownload(entry, finalUrl, ctrl.signal)
      .catch((err) => {
        if (ctrl.signal.aborted) return; // cancel() already marked it
        entry.status = "error";
        entry.speed = "Failed";
        entry.totalSize = entry.downloadedSize;
        save();
        notify();
      })
      .finally(() => aborters.delete(id));
  },

  async _doDownload(entry: DownloadEntry, url: string, signal?: AbortSignal) {
    const response = await fetch(url, { signal });
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
    try { aborters.get(id)?.abort(); } catch {}
    aborters.delete(id);
    const entry = downloads.find((d) => d.id === id);
    if (entry) {
      entry.status = "cancelled";
      save();
      notify();
    }
  },

  // ── Onboarding: smart GGUF download ────────────────────────────────
  /** Pick the best GGUF quant from a repo: exact file → Q4_K_M → Q4 → sane size. */
  async pickQuantFile(repo: string, preferredFile?: string): Promise<HFModelFile | null> {
    const files = (await this.findModelFiles(repo)).filter((f) =>
      f.rfilename.toLowerCase().endsWith(".gguf")
    );
    if (files.length === 0) return null;
    if (preferredFile) {
      const hit = files.find((f) => (f.rfilename.split("/").pop() || "") === preferredFile);
      if (hit) return hit;
    }
    const bySize = [...files].sort((a, b) => (a.size || 0) - (b.size || 0));
    // Skip full-precision bricks (>12 GB) unless nothing else exists.
    const sane = bySize.filter((f) => (f.size || 0) <= 12 * 1024 * 1024 * 1024);
    const pool = sane.length > 0 ? sane : bySize;
    return (
      pool.find((f) => /q4_k_m/i.test(f.rfilename)) ||
      pool.find((f) => /q4/i.test(f.rfilename)) ||
      pool.find((f) => (f.size || 0) >= 500 * 1024 * 1024) ||
      pool[0]
    );
  },

  /**
   * Download the recommended quant straight to the configured folder,
   * streaming chunks to disk (no RAM buffering). Requires a download path.
   */
  async startSmartDownload(
    catalogId: string,
    repo: string,
    preferredFile?: string
  ): Promise<{ entryId?: string; error?: "no-path" | "no-gguf" | "failed" }> {
    const downloadPath = getDownloadPath();
    if (!downloadPath) return { error: "no-path" };
    let file: HFModelFile | null = null;
    try {
      file = await this.pickQuantFile(repo, preferredFile);
    } catch {
      file = null;
    }
    if (!file) return { error: "no-gguf" };

    const name = file.rfilename.split("/").pop() || file.rfilename;
    const url = `https://huggingface.co/${repo}/resolve/main/${file.rfilename}`;
    const totalBytes = file.size || 0;

    const id = crypto.randomUUID();
    const entry: DownloadEntry = {
      id, name, url,
      progress: 0, status: "downloading", speed: "Starting...",
      totalSize: totalBytes ? formatBytes(totalBytes) : "?",
      downloadedSize: "0 B", totalBytes, downloadedBytes: 0,
      repo, catalogId, preferredFile,
    };
    load();
    downloads.unshift(entry);
    save();
    notify();

    const ctrl = new AbortController();
    aborters.set(id, ctrl);
    this._streamToDisk(entry, url, downloadPath, name, catalogId, ctrl.signal)
      .catch((err) => {
        if (ctrl.signal.aborted) return; // cancel() already marked it
        entry.status = "error";
        entry.speed = err instanceof Error ? err.message : "Failed";
        save();
        notify();
      })
      .finally(() => aborters.delete(id));
    return { entryId: id };
  },

  async _streamToDisk(
    entry: DownloadEntry,
    url: string,
    dir: string,
    name: string,
    catalogId: string,
    signal: AbortSignal
  ) {
    const fullPath = `${dir.replace(/\\/g, "/").replace(/\/+$/, "")}/${name}`;
    const started = Date.now();
    const { bytes, total } = await streamDownloadToFile(url, fullPath, {
      signal,
      onProgress: (downloaded, tot) => {
        entry.downloadedBytes = downloaded;
        entry.downloadedSize = formatBytes(downloaded);
        if (tot > 0) {
          entry.totalBytes = tot;
          entry.totalSize = formatBytes(tot);
          entry.progress = Math.round((downloaded / tot) * 100);
        } else {
          entry.progress = 0;
        }
        const elapsed = (Date.now() - started) / 1000;
        if (elapsed > 0.3) entry.speed = `${formatBytes(downloaded / elapsed)}/s`;
        save();
        notify();
      },
    });

    entry.status = "completed";
    entry.progress = 100;
    entry.savedPath = fullPath;
    entry.speed = "Saved";
    entry.downloadedSize = formatBytes(bytes);
    markModelDownloaded(catalogId, name, fullPath, bytes);
    save();
    notify();
  },

  async revealFile(path: string) {
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(path);
    } catch {}
  },

  clear() {
    downloads = [];
    save();
    notify();
  },
};

const LOCAL_MODELS_KEY = "zeqouxchat-local-models";

/**
 * Stream any URL straight to disk with progress — no RAM buffering,
 * abortable, partial file removed on cancel/failure.
 *
 * Flaky-network hardening: resumes with Range requests (up to `attempts`
 * tries, partial file kept between tries). Unknown total size is tolerated —
 * progress just shows downloaded bytes.
 */
export async function streamDownloadToFile(
  url: string,
  fullPath: string,
  opts?: {
    signal?: AbortSignal;
    attempts?: number;
    onProgress?: (downloadedBytes: number, totalBytes: number) => void;
  }
): Promise<{ bytes: number; total: number }> {
  const signal = opts?.signal;
  const maxAttempts = opts?.attempts ?? 4;
  const { open, remove, stat } = await import("@tauri-apps/plugin-fs");

  let downloaded = 0;
  try {
    const st = await stat(fullPath);
    downloaded = st.size || 0;
  } catch {}
  let total = 0;
  let lastError: unknown = null;

  const report = () => opts?.onProgress?.(downloaded, total);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const headers: Record<string, string> = {};
      if (downloaded > 0) headers["Range"] = `bytes=${downloaded}-`;
      const response = await fetch(url, { signal, headers });
      if (response.status === 416) break; // already complete
      const resumed = response.status === 206;
      if (!response.ok && !resumed) throw new Error(`HTTP ${response.status}`);
      const len = Number(response.headers.get("content-length") || "0");
      if (resumed) {
        total = downloaded + len;
      } else {
        // Server ignored Range — restart from scratch.
        if (downloaded > 0) {
          try { await remove(fullPath); } catch {}
          downloaded = 0;
        }
        total = len;
      }
      const reader = response.body?.getReader();
      if (!reader) {
        if (downloaded > 0) break;
        throw new Error("No response body");
      }
      const file = await open(fullPath, { write: true, create: true, append: true });
      let last = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
          await file.write(value);
          downloaded += value.length;
          const now = Date.now();
          if (now - last > 300) {
            last = now;
            report();
          }
        }
      } finally {
        try { await file.close(); } catch {}
      }
      report();
      break; // success
    } catch (err) {
      if (signal?.aborted) {
        try { await remove(fullPath); } catch {}
        throw new DOMException("Aborted", "AbortError");
      }
      lastError = err;
      // Back off, then resume from the partial file.
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }

  if (downloaded === 0) {
    throw lastError instanceof Error ? lastError : new Error("Empty response");
  }
  return { bytes: downloaded, total };
}

export interface LocalModelFile {
  file: string;
  path: string;
  bytes: number;
  at: number;
}

function markModelDownloaded(catalogId: string, file: string, path: string, bytes: number) {
  try {
    const raw = localStorage.getItem(LOCAL_MODELS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[catalogId] = { file, path, bytes, at: Date.now() };
    localStorage.setItem(LOCAL_MODELS_KEY, JSON.stringify(all));
  } catch {}
}

export function getDownloadedModels(): Record<string, LocalModelFile> {
  try {
    const raw = localStorage.getItem(LOCAL_MODELS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
