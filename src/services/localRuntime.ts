import { providerService } from "./providers";
import { formatBytes, streamDownloadToFile } from "./downloads";

export type RuntimeStatus = "missing" | "stopped" | "starting" | "running" | "error";

export const RUNTIME_PORT = 48191;
const ENGINE_REPO = "ggml-org/llama.cpp";

/** Engine filename per target triple — probed in order, first hit wins. */
const CANDIDATES = [
  "llama-server-x86_64-pc-windows-msvc.exe",
  "llama-server-aarch64-apple-darwin",
  "llama-server-x86_64-apple-darwin",
  "llama-server-x86_64-unknown-linux-gnu",
];

interface RuntimeState {
  status: RuntimeStatus;
  port: number;
  modelFile: string | null;
  modelPath: string | null;
  /** Human-readable detail / error. */
  message: string;
  /** Last engine log lines for diagnostics. */
  log: string[];
  /** 0-100 while the engine binary itself is downloading. */
  engineProgress: number;
  /** GPU layers used for the current run (reused on context restart). */
  gpuLayers: number;
}

let state: RuntimeState = {
  status: "stopped",
  port: RUNTIME_PORT,
  modelFile: null,
  modelPath: null,
  message: "",
  log: [],
  engineProgress: 0,
  gpuLayers: 0,
};

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<RuntimeState>) {
  state = { ...state, ...patch };
  notify();
}
function pushLog(line: string) {
  const clean = line.trim();
  if (!clean) return;
  set({ log: [...state.log.slice(-49), clean] });
}

let enginePath: string | null = null;
let unlistenLog: (() => void) | null = null;

async function tauri() {
  const [core, path, fs] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/path"),
    import("@tauri-apps/plugin-fs"),
  ]);
  return { core, path, fs };
}

/** Absolute path of a present engine binary (bundled or downloaded), else null. */
async function findEngine(): Promise<string | null> {
  if (enginePath) return enginePath;
  try {
    const { path, fs } = await tauri();
    const dirs = [await path.resourceDir()];
    try {
      dirs.push(await path.join(await path.appDataDir(), ".."));
    } catch {}
    // Bundled sidecar dir first, then app-data binaries dir.
    const bases: string[] = [];
    for (const d of dirs) bases.push(await path.join(d, "binaries"));
    try {
      bases.push(await path.join(await path.appDataDir(), "binaries"));
    } catch {}
    for (const base of bases) {
      for (const name of CANDIDATES) {
        const full = await path.join(base, name);
        try {
          if (await fs.exists(full)) {
            enginePath = full;
            return full;
          }
        } catch {}
      }
    }
  } catch {}
  return null;
}

export interface EngineAsset {
  url: string;
  name: string;
  size: number;
  label: string;
}

function detectPlatform(): { os: "win" | "mac" | "linux"; arch: "x64" | "arm64"; cuda: boolean } {
  const ua = navigator.userAgent.toLowerCase();
  const os = ua.includes("win") ? "win" : ua.includes("mac") ? "mac" : "linux";
  // navigator.userAgentData is unreliable here — probe CPU via hardwareConcurrency only as hint;
  // default to the safest per-OS choice (x64 runs everywhere incl. Rosetta).
  let arch: "x64" | "arm64" = os === "mac" ? "arm64" : "x64";
  try {
    const data = (navigator as any).userAgentData;
    const plat: string = String(data?.platform || "").toLowerCase();
    if (plat.includes("mac") && /intel/i.test(navigator.userAgent)) arch = "x64";
  } catch {}
  let cuda = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(ext ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "").toLowerCase();
    cuda = os === "win" && (renderer.includes("nvidia") || renderer.includes("geforce") || renderer.includes("rtx"));
  } catch {}
  return { os, arch, cuda };
}

/** Known-good nightly tags (verified to exist). Used when the GitHub API
 *  itself is unreachable — direct release URLs need no API at all. */
const PINNED_TAGS = ["b10964"];

function assetFile(tag: string, os: string, arch: string, cuda: boolean): string {
  const base = `llama-${tag}`;
  if (os === "win") return `${base}-bin-win-${cuda ? "cuda" : "cpu"}-x64.zip`;
  if (os === "mac") return `${base}-bin-macos-${arch === "arm64" ? "arm64" : "x64"}.zip`;
  return `${base}-bin-ubuntu-x64.zip`;
}

async function headSize(url: string): Promise<number> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return -1;
    return Number(res.headers.get("content-length") || "0");
  } catch {
    return -1;
  }
}

async function pickPinnedAsset(): Promise<EngineAsset | null> {
  const { os, arch, cuda } = detectPlatform();
  for (const tag of PINNED_TAGS) {
    const file = assetFile(tag, os, arch, cuda);
    const url = `https://github.com/ggml-org/llama.cpp/releases/download/${tag}/${file}`;
    const size = await headSize(url);
    if (size >= 0) {
      return { url, name: file, size, label: `${tag} · ${file}` };
    }
  }
  return null;
}

/** Pick the right release asset for this machine.
 *
 * NOTE: `releases/latest` (e.g. v0.4.1) ships NO binaries — only nightly-tag.txt.
 * Real builds live in nightly `bXXXX` releases. Strategy: GitHub API first,
 * pinned direct URLs second (no API needed), manual zip as last resort.
 */
export async function pickEngineAsset(): Promise<EngineAsset> {
  const { os, arch, cuda } = detectPlatform();
  let apiError = "";
  try {
    const res = await fetch(`https://api.github.com/repos/${ENGINE_REPO}/releases?per_page=30`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (res.status === 403 || res.status === 429) {
      apiError = "GitHub API limit";
    } else if (!res.ok) {
      apiError = `GitHub API ${res.status}`;
    } else {
      const releases: any[] = await res.json();
      const needles =
        os === "win"
          ? [cuda ? "bin-win-cuda-x64" : "bin-win-cpu-x64", "bin-win-x64"]
          : os === "mac"
            ? [arch === "arm64" ? "bin-macos-arm64" : "bin-macos-x64", "bin-macos"]
            : ["bin-ubuntu-x64", "bin-linux-x64"];
      const lower = (s: string) => s.toLowerCase();
      for (const rel of releases) {
        if (rel.draft) continue;
        const assets: { name: string; browser_download_url: string; size: number }[] = rel.assets || [];
        for (const needle of needles) {
          const hit = assets.find((a) => lower(a.name).includes(needle) && lower(a.name).endsWith(".zip"));
          if (hit) {
            return {
              url: hit.browser_download_url,
              name: hit.name,
              size: hit.size,
              label: `${rel.tag_name || "nightly"} · ${hit.name}`,
            };
          }
        }
      }
      apiError = "no matching build in recent releases";
    }
  } catch (err) {
    apiError = err instanceof Error ? err.message : "API unreachable";
  }

  const pinned = await pickPinnedAsset().catch(() => null);
  if (pinned) return pinned;

  throw new Error(
    `Engine auto-download failed (${apiError}). Use Pick zip with a manually downloaded build: https://github.com/ggml-org/llama.cpp/releases`
  );
}

/** Download + unpack the engine binary. Progress 0-100 via callback. */
export async function downloadEngine(onProgress?: (pct: number, downloaded: string, total: string) => void): Promise<string> {
  const { core, path, fs } = await tauri();
  const asset = await pickEngineAsset();
  const dir = await path.join(await path.appDataDir(), "binaries");
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
  const zipPath = await path.join(dir, "engine-download.zip");
  set({ engineProgress: 0 });
  const ctrl = new AbortController();
  try {
    await streamDownloadToFile(asset.url, zipPath, {
      signal: ctrl.signal,
      onProgress: (downloadedBytes, totalBytes) => {
        const pct = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        set({ engineProgress: pct });
        onProgress?.(pct, formatBytes(downloadedBytes), formatBytes(totalBytes));
      },
    });
  } catch (err) {
    try { await fs.remove(zipPath); } catch {}
    throw err;
  }
  const dest = await path.join(dir, engineDestName());
  await core.invoke<number>("engine_unzip", { zipPath, destPath: dest });
  try { await fs.remove(zipPath); } catch {}
  enginePath = dest;
  set({ engineProgress: 100, status: "stopped", message: `Engine ready (${asset.name})` });
  return dest;
}

const VCREDIST_URL = "https://aka.ms/vs/17/release/vc_redist.x64.exe";

/**
 * Download the MSVC redistributable and launch its installer.
 * Windows shows a UAC prompt — one click from the user, no manual hunting.
 * Progress 0-100 via callback.
 */
export async function installVCRedist(
  onProgress?: (pct: number, downloaded: string, total: string) => void
): Promise<void> {
  const { path, fs } = await tauri();
  const dir = await path.join(await path.appCacheDir(), "redist");
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
  const exePath = await path.join(dir, "vc_redist.x64.exe");
  const ctrl = new AbortController();
  await streamDownloadToFile(VCREDIST_URL, exePath, {
    signal: ctrl.signal,
    onProgress: (downloadedBytes, totalBytes) => {
      const pct = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      set({ engineProgress: pct });
      onProgress?.(pct, formatBytes(downloadedBytes), formatBytes(totalBytes));
    },
  });
  set({ engineProgress: 100 });
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(exePath);
}

/** Triple filename for THIS machine (used both for auto-download and manual zip). */
export function engineDestName(): string {  const { os, arch } = detectPlatform();
  return os === "win"
    ? CANDIDATES[0]
    : os === "mac"
      ? arch === "arm64" ? CANDIDATES[1] : CANDIDATES[2]
      : CANDIDATES[3];
}

/** Install the engine from a user-picked release zip (offline fallback). */
export async function installEngineFromZip(zipPath: string): Promise<string> {
  const { core, path } = await tauri();
  const dir = await path.join(await path.appDataDir(), "binaries");
  const dest = await path.join(dir, engineDestName());
  await core.invoke<number>("engine_unzip", { zipPath, destPath: dest });
  enginePath = dest;
  set({ engineProgress: 100, status: "stopped", message: "Engine ready (manual install)" });
  return dest;
}

async function waitHealthy(baseUrl: string): Promise<boolean> {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

export const localRuntime = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: () => state,

  /** Is an engine binary present (bundled or downloaded)? Never throws. */
  async probe(): Promise<boolean> {
    const found = await findEngine();
    if (!found && state.status !== "running" && state.status !== "starting") {
      set({ status: "missing", message: "" });
    } else if (found && state.status === "missing") {
      set({ status: "stopped", message: "" });
    }
    return !!found;
  },

  async start(
    modelPath: string,
    opts?: { gpuLayers?: number; ctx?: number; displayName?: string }
  ): Promise<boolean> {
    if (state.status === "running" || state.status === "starting") await this.stop();
    const bin = await findEngine();
    if (!bin) {
      set({ status: "missing", message: "" });
      return false;
    }
    // The file may be partial/deleted — never feed a broken GGUF to the engine.
    try {
      const fs = await import("@tauri-apps/plugin-fs");
      const st = await fs.stat(modelPath);
      if (!st.size || st.size < 10 * 1024 * 1024) {
        set({ status: "error", message: "Model file is missing or incomplete — finish the download first" });
        return false;
      }
    } catch (err) {
      set({ status: "error", message: err instanceof Error ? err.message : "Model file not accessible" });
      return false;
    }
    let core: typeof import("@tauri-apps/api/core");
    try {
      core = await import("@tauri-apps/api/core");
    } catch {
      set({ status: "error", message: "Tauri runtime not available here" });
      return false;
    }

    const port = RUNTIME_PORT;
    const baseUrl = `http://127.0.0.1:${port}`;
    const file = modelPath.split("\\").pop()?.split("/").pop() || modelPath;
    const displayName = opts?.displayName || file.replace(/\.gguf$/i, "");
    const gpuLayers = opts?.gpuLayers ?? 0;
    set({ status: "starting", port, modelFile: file, modelPath, message: `Loading ${file}…`, log: [], gpuLayers });
    notify();

    try {
      if (unlistenLog) { try { unlistenLog(); } catch {} unlistenLog = null; }
      const { listen } = await import("@tauri-apps/api/event");
      unlistenLog = await listen<string>("engine-log", (e) => pushLog(String(e.payload)));
    } catch {}

    const args = [
      "-m", modelPath,
      "--port", String(port),
      "-c", String(opts?.ctx ?? 4096),
      "--no-webui",
      "--n-gpu-layers", String(gpuLayers),
    ];
    try {
      await core.invoke<number>("engine_start", { path: bin, args });
    } catch (err) {
      set({ status: "error", message: err instanceof Error ? err.message : String(err) });
      return false;
    }

    const up = await waitHealthy(baseUrl).catch(() => false);
    if (!up) {
      try { await core.invoke("engine_stop"); } catch {}
      set({ status: "error", message: "Engine did not answer /health in 120s — see log below" });
      return false;
    }

    providerService.updateProvider("llamacpp", {
      baseUrl: `${baseUrl}/v1`,
      models: [displayName],
    });
    set({ status: "running", message: `${displayName} on ${baseUrl}` });
    return true;
  },

  async stop(): Promise<void> {
    try {
      const core = await import("@tauri-apps/api/core");
      await core.invoke("engine_stop");
    } catch {}
    if (unlistenLog) { try { unlistenLog(); } catch {} unlistenLog = null; }
    if (state.status === "running" || state.status === "starting") {
      set({ status: "stopped", message: "", modelFile: null, modelPath: null });
    }
  },
};
