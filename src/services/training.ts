import { isTauri as isTauriEnv } from "@/lib/platform";

export interface PythonEnv {
  available: boolean;
  version: string;
  dependencies: Record<string, boolean>;
}

export interface TrainingConfig {
  name: string;
  mode: "scratch" | "lora";
  dataset_path: string;
  base_model?: string;
  epochs: number;
  batch_size: number;
  learning_rate: number;
  max_length: number;
  lora_r?: number;
  lora_alpha?: number;
  lora_dropout?: number;
  quantization?: "none" | "4bit" | "8bit";
  gradient_accumulation?: number;
}

export interface TrainedModel {
  id: string;
  name: string;
  train_mode: string;
  base_model: string;
  epochs: number | string;
  final_loss: number | null;
  size: string;
  path: string;
  status: string;
  created: string;
}

export interface DatasetInfo {
  id: string;
  name: string;
  size: number;
  format: string;
  source: string;
  path: string;
  builtin?: boolean;
  lang?: string;
}

interface TrainingProgress {
  progress: number;
  step: number;
  total_steps: number;
  loss: number | null;
  epoch: number;
  message: string;
}

let trainingActive = false;
let trainingProgress: TrainingProgress = {
  progress: 0, step: 0, total_steps: 0, loss: null, epoch: 0, message: "",
};
let currentJobId: string | null = null;
let outputDir: string | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function invokeRust<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke(cmd, args);
  } catch (e) {
    throw e;
  }
}

const DATASETS_KEY = "zeqouxchat-training-datasets";
const MODELS_KEY = "zeqouxchat-trained-models";

function loadDatasets(): DatasetInfo[] {
  try { return JSON.parse(localStorage.getItem(DATASETS_KEY) || "[]"); } catch { return []; }
}
function saveDatasets(datasets: DatasetInfo[]) {
  localStorage.setItem(DATASETS_KEY, JSON.stringify(datasets));
}
function loadModels(): TrainedModel[] {
  try { return JSON.parse(localStorage.getItem(MODELS_KEY) || "[]"); } catch { return []; }
}
function saveModels(models: TrainedModel[]) {
  localStorage.setItem(MODELS_KEY, JSON.stringify(models));
}

// ── Bilingual default dataset (Aider-style) ─────────────────────────────────
// 695 samples: 460 ru + 235 en, including 40 code SEARCH/REPLACE samples (Aider format)
const DEFAULT_BILINGUAL: DatasetInfo = {
  id: "bilingual_aider_v1",
  name: "Default Bilingual (EN/RU) — Aider-style Code + Chat",
  size: 695,
  format: "json",
  source: "builtin",
  path: "AIens/datasets/default_bilingual_aider_v1.json",
  builtin: true,
  lang: "bilingual",
};

export const trainingService = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  getState: () => ({
    trainingActive,
    trainingProgress,
    datasets: loadDatasets(),
    models: loadModels(),
  }),

  async checkEnvironment(): Promise<PythonEnv> {
    // Try Rust first
    try {
      const env = await invokeRust<PythonEnv>("check_python");
      if (env) return env;
    } catch {}
    // Fallback: try shell python --version (Tauri) or just report web mode
    const isTauri = isTauriEnv();
    if (!isTauri) {
      return { available: false, version: "Web mode — requires Tauri desktop for training", dependencies: {} };
    }
    try {
      const { Command } = await import("@tauri-apps/plugin-shell");
      let out: any;
      try {
        out = await (Command as any).create("python", ["--version"]).execute();
      } catch {
        out = await (Command as any).create("python3", ["--version"]).execute();
      }
      const ver = (out.stdout || out.stderr || "").trim() || "Python found";
      const available = out.code === 0 && ver.toLowerCase().includes("python");
      return { available, version: ver, dependencies: {} };
    } catch {
      return { available: false, version: "", dependencies: {} };
    }
  },

  getBuiltinDatasets(): DatasetInfo[] {
    return [DEFAULT_BILINGUAL];
  },

  async importDataset(path: string): Promise<DatasetInfo | null> {
    try {
      const filename = path.split(/[/\\]/).pop() || "dataset.json";
      // Try to count records quickly via python helper or just set 0 and let training count later
      let size = 0;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        // try to use training_data.count_records_fast if available via python shell
        const { Command } = await import("@tauri-apps/plugin-shell");
        const code = `import sys; sys.path.insert(0, 'AIens'); from training_data import count_records_fast; print(count_records_fast(r"${path.replace(/"/g, '\\"')}"))`;
        let out: any;
        try { out = await (Command as any).create("python", ["-c", code]).execute(); }
        catch { out = await (Command as any).create("python3", ["-c", code]).execute(); }
        const n = parseInt((out.stdout || "").trim());
        if (!isNaN(n)) size = n;
      } catch {}
      const dataset: DatasetInfo = {
        id: `local_${Date.now()}`,
        name: filename,
        size,
        format: filename.endsWith(".csv") ? "csv" : filename.endsWith(".jsonl") ? "jsonl" : "json",
        source: "local",
        path,
      };
      const datasets = loadDatasets();
      datasets.push(dataset);
      saveDatasets(datasets);
      notify();
      return dataset;
    } catch { return null; }
  },

  removeDataset(id: string) {
    const datasets = loadDatasets().filter((d) => d.id !== id && !d.builtin);
    saveDatasets(datasets);
    notify();
  },

  getDatasets(): DatasetInfo[] {
    return [...this.getBuiltinDatasets(), ...loadDatasets()];
  },

  async startTraining(config: TrainingConfig): Promise<boolean> {
    if (trainingActive) return false;
    const isTauri = isTauriEnv();
    if (!isTauri) {
      trainingProgress = { progress: 0, step: 0, total_steps: 0, loss: null, epoch: 0, message: "Training requires Tauri desktop (.exe) — not available in browser." };
      notify();
      return false;
    }
    trainingActive = true;
    trainingProgress = { progress: 0, step: 0, total_steps: 0, loss: null, epoch: 0, message: "Подготовка..." };
    notify();

    try {
      // Resolve dataset path: "builtin" or empty -> default bilingual
      let datasetPath = config.dataset_path;
      if (!datasetPath || datasetPath === "builtin" || datasetPath === DEFAULT_BILINGUAL.id) {
        datasetPath = DEFAULT_BILINGUAL.path;
      }
      // If custom dataset id, resolve to actual path
      const custom = loadDatasets().find(d => d.id === datasetPath || d.path === datasetPath);
      if (custom) datasetPath = custom.path;

      // Try to get AIens dir via Rust, fallback to relative
      let aiensDir = "AIens";
      try {
        aiensDir = await invokeRust<string>("get_aiens_dir");
      } catch {
        try {
          const { appDataDir, join } = await import("@tauri-apps/api/path");
          const base = await appDataDir();
          // In dev, AIens is in project root; in prod, it may be in resource dir
          // Try to use relative AIens first, fallback to appData
          aiensDir = base; // will be overridden by python's path handling
        } catch {}
      }

      // Build job config similar to MCP training
      const jobId = `job_${Date.now()}`;
      currentJobId = jobId;

      // Use shell to run training_worker.py / lora_trainer.py directly (Aider-style: use SEARCH/REPLACE dataset)
      const { Command } = await import("@tauri-apps/plugin-shell");
      const fullConfig = {
        ...config,
        dataset_path: datasetPath,
        aiens_dir: aiensDir,
        // Aider-inspired defaults: use code-aware tokenization, keep context
        d_model: (config as any).d_model || 256,
        nhead: (config as any).nhead || 4,
      };

      // Create job file via python (to handle paths correctly)
      const jobJson = JSON.stringify({
        id: jobId,
        output_dir: `AIens/trained_models/${config.name}`,
        config: fullConfig,
        stop_file: `AIens/training_jobs/${jobId}.stop`,
      });

      const pySetup = `
import json, os, sys
from pathlib import Path
job = json.loads(r'''${jobJson.replace(/'/g, "\\'")}''')
out = Path(job["output_dir"])
out.mkdir(parents=True, exist_ok=True)
job_path = Path(f"AIens/training_jobs/{job['id']}.json")
job_path.parent.mkdir(parents=True, exist_ok=True)
job_path.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
print(str(job_path))
`;
      let setupOut: any;
      try {
        setupOut = await (Command as any).create("python", ["-c", pySetup]).execute();
      } catch {
        setupOut = await (Command as any).create("python3", ["-c", pySetup]).execute();
      }
      if (setupOut.code !== 0) throw new Error(setupOut.stderr || setupOut.stdout || "Failed to create job file");
      const jobPath = (setupOut.stdout || "").trim().split("\n").pop()?.trim() || `AIens/training_jobs/${jobId}.json`;

      trainingProgress = { ...trainingProgress, progress: 5, message: "Запуск обучения (Aider-style)..." };
      notify();

      // Choose worker: lora_trainer.py for lora, training_worker.py for scratch (Aider uses scratch-like for code edits)
      const worker = config.mode === "lora" ? "AIens/lora_trainer.py" : "AIens/training_worker.py";
      const fallbackWorker = "AIens/training_worker.py";

      // Run training and stream progress via stdout parsing
      const runCode = `
import subprocess, sys, json, time, os
from pathlib import Path
job_path = r"${jobPath.replace(/\\/g, "\\\\")}"
worker = r"${worker}"
if not Path(worker).exists():
    worker = r"${fallbackWorker}"
print(json.dumps({"event":"training-status","detail":{"message":f"Worker: {worker}","phase":"worker_start"}}), flush=True)
proc = subprocess.Popen([sys.executable, worker, "--job", job_path], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
for line in proc.stdout:
    line=line.strip()
    if not line: continue
    try:
        obj=json.loads(line)
        print(json.dumps(obj), flush=True)
    except:
        print(json.dumps({"event":"training-progress","detail":{"message":line}}), flush=True)
proc.wait()
sys.exit(proc.returncode or 0)
`;
      // Execute and stream
      let cmd: any;
      try {
        cmd = (Command as any).create("python", ["-c", runCode]);
      } catch {
        cmd = (Command as any).create("python3", ["-c", runCode]);
      }
      // Use sidecar-like streaming via Command events
      const output = await new Promise<string>((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        // Tauri shell Command has .stdout etc? Use execute and capture
        cmd.execute().then((res: any) => {
          const full = [res.stdout, res.stderr].filter(Boolean).join("\n");
          if (res.code === 0) resolve(full);
          else reject(new Error(full || `Exit ${res.code}`));
        }).catch(reject);
        // Also try to listen to progress via events if available
        try {
          (cmd as any).stdout?.on?.("data", (line: string) => {
            try {
              const obj = JSON.parse(line);
              if (obj.event === "training-progress") {
                const d = obj.detail;
                trainingProgress = {
                  progress: d.progress ?? trainingProgress.progress,
                  step: d.step ?? trainingProgress.step,
                  total_steps: d.total_steps ?? trainingProgress.total_steps,
                  loss: d.loss ?? trainingProgress.loss,
                  epoch: d.epoch ?? trainingProgress.epoch,
                  message: d.message || trainingProgress.message,
                };
                notify();
              } else if (obj.event === "training-status") {
                trainingProgress = { ...trainingProgress, message: obj.detail?.message || trainingProgress.message };
                notify();
              }
            } catch {}
            stdout += line;
          });
        } catch {}
      });

      // If we reach here, training succeeded (or at least process exited 0)
      const model: TrainedModel = {
        id: `model_${Date.now()}`,
        name: config.name,
        train_mode: config.mode,
        base_model: config.base_model || "scratch",
        epochs: config.epochs,
        final_loss: trainingProgress.loss,
        size: "?",
        path: `AIens/trained_models/${config.name}`,
        status: "ready",
        created: new Date().toISOString(),
      };
      const models = loadModels();
      models.unshift(model);
      saveModels(models);
      trainingActive = false;
      trainingProgress = { progress: 100, step: trainingProgress.step, total_steps: trainingProgress.total_steps, loss: trainingProgress.loss, epoch: config.epochs, message: "Готово! Модель сохранена." };
      notify();
      return true;
    } catch (err: any) {
      console.warn("Training failed:", err);
      const msg = err?.message || String(err);
      trainingActive = false;
      trainingProgress = { ...trainingProgress, message: msg };
      notify();
      return false;
    }
  },

  stopTraining() {
    try { invokeRust("stop_training").catch(() => {}); } catch {}
    trainingActive = false;
    trainingProgress = { ...trainingProgress, message: "Остановлено пользователем" };
    notify();
  },

  getTrainedModels(): TrainedModel[] {
    return loadModels();
  },

  deleteModel(id: string) {
    const models = loadModels().filter((m) => m.id !== id);
    saveModels(models);
    notify();
  },

  getTrainingProgress() {
    return trainingProgress;
  },

  isTrainingActive() {
    return trainingActive;
  },
};
