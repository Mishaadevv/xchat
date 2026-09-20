/**
 * Real Python environment detection and management.
 *
 * Why this exists: a machine may have several interpreters (3.12, 3.13,
 * 3.14…), the one named `python` on PATH is not necessarily the useful one,
 * and torch wheels do not exist for the newest releases. So the app must
 * *find* every candidate, check which ones can actually run the ML stack,
 * create its own venv and install into it — for real, not as a stub.
 *
 * Every process runs through the Rust `proc_start` command with an absolute
 * program path, so no shell-scope entry is needed and the interpreter choice
 * is honoured exactly.
 */
import { isTauri } from "@/lib/platform";

export interface InterpreterInfo {
  /** Absolute path of the executable (never just "python"). */
  executable: string;
  version: string;
  versionTuple: number[];
  implementation: string;
  /** Can this interpreter import torch right now? */
  hasTorch: boolean;
  /** Free-text source, e.g. "py launcher -V:3.12". */
  source: string;
  /** The app-managed venv derived from this interpreter, if it exists. */
  venvPython: string | null;
}

export interface PythonEnvState {
  interpreters: InterpreterInfo[];
  /** Absolute path of the interpreter the app will use for training. */
  selected: string | null;
  /** Probing is in progress. */
  scanning: boolean;
  /** Install/venv job state. */
  installing: boolean;
  installLog: string[];
  installProgress: number | null;
  lastError: string | null;
}

type Listener = () => void;

const state: PythonEnvState = {
  interpreters: [],
  selected: null,
  scanning: false,
  installing: false,
  installLog: [],
  installProgress: null,
  lastError: null,
};

const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<PythonEnvState>) {
  Object.assign(state, patch);
  notify();
}

const VENV_NAME = "aiens-runtime";

async function tauri() {
  const [core, path, fs, event] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/path"),
    import("@tauri-apps/plugin-fs"),
    import("@tauri-apps/api/event"),
  ]);
  return { core, path, fs, event };
}

/* ------------------------------------------------------------------ proc */

let unlistenLog: (() => void) | null = null;

async function ensureProcListeners() {
  if (unlistenLog || !isTauri()) return;
  const { event } = await tauri();
  unlistenLog = await event.listen<[string, string]>("proc-log", (e) => {
    const [id, line] = e.payload;
    if (id === "aiens-install") {
      const clean = String(line).replace(/\s+$/, "");
      if (clean) {
        set({ installLog: [...state.installLog.slice(-199), clean] });
        // pip progress lines look like "Downloading torch-2.4.1..." — rough %.
        const pct = parsePipProgress(clean);
        if (pct != null) set({ installProgress: pct });
      }
    }
  });
}

function parsePipProgress(line: string): number | null {
  const m = line.match(/(\d{1,2}(?:\.\d)?)%\|/);
  if (m) return Number(m[1]);
  // "Downloading torch-2.x.x (797 kB)" → weight downloads into a rough range.
  if (/Downloading .*(torch|nvidia|triton)/i.test(line)) {
    const cur = state.installProgress ?? 5;
    return Math.min(90, cur + 2);
  }
  return null;
}

/** Run a program to completion, collecting stdout lines. Never throws for
 *  non-zero exits — callers inspect `code`. Exported for other services that
 *  must run the *selected* interpreter (dataset counting, MCP tools). */
export async function runProc(
  program: string,
  args: string[],
  cwd?: string,
  timeoutMs = 60_000,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  if (!isTauri()) throw new Error("Tauri desktop required");
  const { core, event } = await tauri();
  const id = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const stdout: string[] = [];
  const stderr: string[] = [];
  const unLog = await event.listen<[string, string]>("proc-log", (e) => {
    const [tag, line] = e.payload;
    if (tag !== id) return;
    stdout.push(line);
    if (line.includes("\r")) stderr.push(line);
  });
  const unExit = await event.listen<[string, number | null]>("proc-exit", (e) => {
    if (e.payload[0] === id) done = true;
  });

  let done = false;
  try {
    await core.invoke<number>("proc_start", {
      id,
      program,
      args,
      cwd: cwd ?? null,
    });
  } catch (err) {
    unLog();
    unExit();
    throw err;
  }

  const deadline = Date.now() + timeoutMs;
  while (!done && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
  }
  unLog();
  unExit();
  if (!done) throw new Error(`${program} timed out after ${Math.round(timeoutMs / 1000)}s`);

  return { code: null, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}

/* ------------------------------------------------------------ discovery */

/** Windows install roots where the official python.org installer drops dirs. */
async function windowsInstallDirs(): Promise<string[]> {
  if (!navigator.userAgent.toLowerCase().includes("win")) return [];
  const { path, fs } = await tauri();
  const dirs: string[] = [];
  const bases = [
    await path.localDataDir(), // %LOCALAPPDATA%\Programs\Python\Python3XX
    "C:\\Python312",
    "C:\\Python313",
    "C:\\Python311",
    "C:\\Python310",
  ];
  for (const base of bases) {
    try {
      const parent = base.endsWith("Python") || base.includes("Programs") ? base : base;
      const entries = await fs.readDir(parent);
      for (const entry of entries) {
        const name = entry.name.toLowerCase();
        const full = await path.join(parent, entry.name);
        if (/^python3(10|11|12|13)$/.test(name) && base.includes("Programs")) {
          dirs.push(await path.join(full, "python.exe"));
        } else if (/^C:\\Python3(10|11|12|13)$/.test(full)) {
          dirs.push(await path.join(full, "python.exe"));
        }
      }
    } catch {}
  }
  return dirs;
}

/** Ask the py launcher for every registered interpreter (the reliable way). */
async function pyLauncherCandidates(): Promise<{ exe: string; tag: string }[]> {
  const out: { exe: string; tag: string }[] = [];
  try {
    const res = await runProc("py", ["-0p"], undefined, 15_000);
    const text = `${res.stdout}\n${res.stderr}`;
    // Lines look like: " -V:3.12 *        Python 3.12 (64-bit)"
    //                  " C:\\...\\python.exe"
    const lines = text.split(/\r?\n/);
    let currentTag = "";
    for (const line of lines) {
      const tagMatch = line.match(/-V:?(\d\.\d+)/);
      if (tagMatch) currentTag = tagMatch[1];
      const exeMatch = line.match(/([A-Za-z]:\\[^\s]+python\.exe)/i);
      if (exeMatch) {
        out.push({ exe: exeMatch[1], tag: currentTag });
        currentTag = "";
      }
    }
  } catch {}
  return out;
}

/** True when `exe -c "import torch"` succeeds. */
async function probeTorch(exe: string): Promise<{ ok: boolean; version: string }> {
  try {
    const res = await runProc(exe, ["-c", "import torch; print(torch.__version__)"], undefined, 30_000);
    const text = res.stdout.trim();
    if (text.startsWith("2.") || text.startsWith("1.")) return { ok: true, version: text.split(/\s+/)[0] };
  } catch {}
  return { ok: false, version: "" };
}

async function probeVersion(exe: string): Promise<{ version: string; tuple: number[]; impl: string } | null> {
  try {
    const res = await runProc(
      exe,
      ["-c", "import sys; print(f\"{sys.version_info[0]}.{sys.version_info[1]}.{sys.version_info[2]} {sys.implementation.name}\")"],
      undefined,
      15_000,
    );
    const m = res.stdout.trim().match(/(\d+)\.(\d+)\.(\d+)\s+(\w+)/);
    if (m) {
      return {
        version: `${m[1]}.${m[2]}.${m[3]}`,
        tuple: [Number(m[1]), Number(m[2]), Number(m[3])],
        impl: m[4],
      };
    }
  } catch {}
  return null;
}

/** Paths of app-managed venvs for this interpreter, if they exist. */
async function venvFor(exe: string): Promise<string | null> {
  const { path, fs } = await tauri();
  try {
    const base = await path.appDataDir();
    const dirHash = exe.replace(/[^A-Za-z0-9]/g, "_").slice(-40);
    const venvPython = await path.join(base, "aiens-venvs", dirHash, VENV_NAME, venvBinName());
    if (await fs.exists(venvPython)) return venvPython;
  } catch {}
  return null;
}

function venvBinName(): string {
  return navigator.userAgent.toLowerCase().includes("win") ? "Scripts\\python.exe" : "bin/python";
}

/* --------------------------------------------------------------- public */

export const pythonEnv = {
  subscribe: (l: Listener) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getState: () => state,

  /** Find every interpreter on this machine and probe it for real. */
  async scan(): Promise<InterpreterInfo[]> {
    if (!isTauri()) {
      set({ lastError: "Tauri desktop required" });
      return [];
    }
    set({ scanning: true, lastError: null });
    try {
      await ensureProcListeners();
      const { path, fs } = await tauri();

      const candidates = new Map<string, string>(); // exe → source
      for (const { exe, tag } of await pyLauncherCandidates()) {
        candidates.set(exe.toLowerCase(), `py launcher ${tag ? `-V:${tag}` : ""}`.trim());
      }
      for (const exe of await windowsInstallDirs()) {
        if (!candidates.has(exe.toLowerCase())) candidates.set(exe.toLowerCase(), "install dir");
      }
      // Bare "python"/"python3" on PATH as the last candidates.
      for (const name of ["python", "python3"]) {
        try {
          const res = await runProc(name, ["-c", "import sys; print(sys.executable)"], undefined, 10_000);
          const exe = res.stdout.trim().split(/\r?\n/).pop()?.trim();
          if (exe && /^([A-Za-z]:\\|\/)/.test(exe) && !candidates.has(exe.toLowerCase())) {
            candidates.set(exe.toLowerCase(), "PATH");
          }
        } catch {}
      }

      const interpreters: InterpreterInfo[] = [];
      for (const [exeLower, source] of candidates) {
        const exe = exeLower;
        const ver = await probeVersion(exe);
        if (!ver) continue; // broken entry (e.g. the WindowsApps alias stub)
        // Only 3.10–3.13: torch ships wheels for these; 3.14+ has none yet.
        if (ver.tuple[0] !== 3 || ver.tuple[1] < 10 || ver.tuple[1] > 13) continue;
        if (!(await fs.exists(exe))) continue;
        const torch = await probeTorch(exe);
        interpreters.push({
          executable: exe,
          version: ver.version,
          versionTuple: ver.tuple,
          implementation: ver.impl,
          hasTorch: torch.ok,
          source,
          venvPython: await venvFor(exe),
        });
      }
      interpreters.sort((a, b) => {
        // Torch-capable first, then newest version.
        if (a.hasTorch !== b.hasTorch) return a.hasTorch ? -1 : 1;
        return b.versionTuple.join(".").localeCompare(a.versionTuple.join("."), undefined, { numeric: true });
      });

      const selected = state.selected ?? interpreters[0]?.executable ?? null;
      set({ interpreters, selected, scanning: false });
      return interpreters;
    } catch (err) {
      set({ scanning: false, lastError: err instanceof Error ? err.message : String(err) });
      return [];
    }
  },

  async select(executable: string): Promise<void> {
    set({ selected: executable });
    if (!state.interpreters.some((i) => i.executable === executable)) {
      await this.scan();
    }
    notify();
  },

  /** The interpreter that training will actually use (venv if present). */
  activeExecutable(): string | null {
    const sel = state.interpreters.find((i) => i.executable === state.selected);
    if (!sel) return null;
    return sel.venvPython ?? sel.executable;
  },

  /** Create an isolated venv from the selected interpreter. */
  async createVenv(onProgress?: (msg: string) => void): Promise<string | null> {
    const sel = state.interpreters.find((i) => i.executable === state.selected);
    if (!sel) {
      set({ lastError: "No interpreter selected" });
      return null;
    }
    if (!isTauri()) throw new Error("Tauri desktop required");
    const { path } = await tauri();
    const base = await path.appDataDir();
    const dirHash = sel.executable.replace(/[^A-Za-z0-9]/g, "_").slice(-40);
    const venvDir = await path.join(base, "aiens-venvs", dirHash, VENV_NAME);

    set({ installing: true, installLog: [], installProgress: 2 });
    try {
      const res = await runProc(
        sel.executable,
        ["-m", "venv", venvDir, "--clear"],
        undefined,
        120_000,
      );
      const log = `${res.stdout}\n${res.stderr}`.trim();
      if (log) set({ installLog: log.split(/\r?\n/).slice(-50) });
      const venvPython = await path.join(venvDir, venvBinName());
      sel.venvPython = venvPython;
      set({ installing: false, installProgress: 100 });
      onProgress?.(`venv ready: ${venvPython}`);
      notify();
      return venvPython;
    } catch (err) {
      set({ installing: false, lastError: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  /**
   * Install the ML stack into the app venv: CPU torch by default, CUDA torch
   * when the machine has an NVIDIA GPU (the user can force either).
   */
  async installRuntime(opts?: { cuda?: boolean; onLog?: (line: string) => void }): Promise<boolean> {
    if (!isTauri()) throw new Error("Tauri desktop required");
    const target = this.activeExecutable();
    if (!target) {
      set({ lastError: "Create the runtime environment first (Settings → Python)" });
      return false;
    }
    set({ installing: true, installLog: [], installProgress: 1, lastError: null });
    try {
      const cuda = opts?.cuda ?? (await hasNvidiaGpu());
      const indexUrl = cuda ? "https://download.pytorch.org/whl/cu124" : "https://download.pytorch.org/whl/cpu";
      const pkgs = ["torch", "transformers", "datasets", "accelerate", "peft", "sentencepiece"];
      const args = ["-m", "pip", "install", "--upgrade", "pip", "-q"];
      await runProc(target, args, undefined, 180_000);

      set({ installProgress: 5 });
      const installArgs = [
        "-m", "pip", "install",
        "--index-url", indexUrl,
        "--extra-index-url", "https://pypi.org/simple",
        "-q", "--progress-bar", "on",
        ...pkgs,
      ];
      // Large download — CUDA torch is ~2.5 GB; give it 40 minutes.
      const res = await runProc(target, installArgs, undefined, 40 * 60_000);
      const text = `${res.stdout}\n${res.stderr}`;
      for (const line of text.split(/\r?\n/).slice(-40)) onLogLine(line, opts);

      const check = await runProc(
        target,
        ["-c", "import torch, transformers, peft, datasets, accelerate; print(\"OK\", torch.__version__, torch.cuda.is_available())"],
        undefined,
        60_000,
      );
      const okText = check.stdout.trim();
      const ok = okText.startsWith("OK");
      set({ installing: false, installProgress: ok ? 100 : null });
      if (ok) {
        // Refresh hasTorch flags now that the venv has the stack.
        await this.scan();
        return true;
      }
      set({ lastError: `Verification failed: ${okText || "import error"} ${check.stderr.slice(-400)}` });
      return false;
    } catch (err) {
      set({ installing: false, lastError: err instanceof Error ? err.message : String(err) });
      return false;
    }
  },

  /** Quick honest check used by the Training screen banner. */
  async quickCheck(): Promise<{ available: boolean; version: string; hasTorch: boolean; detail: string }> {
    if (!isTauri()) {
      return { available: false, version: "", hasTorch: false, detail: "Web mode — training needs the desktop app" };
    }
    if (!state.interpreters.length) await this.scan();
    const active = this.activeExecutable();
    if (!active) {
      return { available: false, version: "", hasTorch: false, detail: "No Python 3.10–3.13 found" };
    }
    const info = state.interpreters.find((i) => i.executable === state.selected || i.venvPython === active);
    const torch = await probeTorch(active);
    return {
      available: true,
      version: info?.version ?? "",
      hasTorch: torch.ok,
      detail: torch.ok
        ? `Python ${info?.version} + torch ${torch.version}${active.includes("venv") ? " (venv)" : ""}`
        : `Python ${info?.version} found, torch missing — install the runtime`,
    };
  },
};

function onLogLine(line: string, opts?: { onLog?: (line: string) => void }) {
  opts?.onLog?.(line);
}

/** NVIDIA GPU detection via nvidia-smi (any PATH) — best effort. */
export async function hasNvidiaGpu(): Promise<boolean> {
  try {
    const res = await runProc("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], undefined, 8_000);
    return res.stdout.trim().length > 0;
  } catch {}
  // Windows: check the driver registry hint via the standard install path.
  try {
    const { fs } = await tauri();
    return await fs.exists("C:\\Windows\\System32\\nvidia-smi.exe");
  } catch {}
  return false;
}
