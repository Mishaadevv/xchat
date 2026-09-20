import { isTauri as isTauriEnv } from "@/lib/platform";
import { pythonEnv } from "@/services/pythonEnv";

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
  /** The built-in used when nothing has been chosen. */
  default?: boolean;
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
let currentProcPid: number | null = null;
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

// ── Bundled Zeqou datasets ──────────────────────────────────────────────────
// Ship inside the app (AIens/datasets/zeqou — AIens is a bundle resource), so
// they are available with no import. The entry marked `default` is what runs
// when the user has not picked a dataset of their own.
const ZEQOU_BUILTINS: DatasetInfo[] = [
  { id: "zeqou_v2", name: "Zeqou Default v2 — EN→RU translation + thinking", size: 12316, format: "json", source: "builtin", path: "AIens/datasets/zeqou/dataset_v2.json", builtin: true, default: true, lang: "EN→RU" },
  { id: "zeqou_v1", name: "Zeqou Default v1 — EN→RU translation pairs", size: 3566, format: "json", source: "builtin", path: "AIens/datasets/zeqou/dataset.json", builtin: true, lang: "EN→RU" },
  { id: "zeqou_dialog_ru_en", name: "Dialogue — Russian ↔ English", size: 550, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/dialog_ru_en_1.json", builtin: true, lang: "RU/EN" },
  { id: "zeqou_dialog_es_fr", name: "Dialogue — Spanish ↔ French", size: 550, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/dialog_es_fr_2.json", builtin: true, lang: "ES/FR" },
  { id: "zeqou_dialog_de_zh", name: "Dialogue — German ↔ Chinese", size: 550, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/dialog_de_zh_3.json", builtin: true, lang: "DE/ZH" },
  { id: "zeqou_dialog_ja_mix", name: "Dialogue — Japanese & mixed", size: 400, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/dialog_ja_mix_4.json", builtin: true, lang: "JA/mix" },
  { id: "zeqou_code_python", name: "Code — Python", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/code_python_5.json", builtin: true, lang: "code" },
  { id: "zeqou_code_jvm", name: "Code — JVM", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/code_jvm_6.json", builtin: true, lang: "code" },
  { id: "zeqou_code_web", name: "Code — Web", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/code_web_7.json", builtin: true, lang: "code" },
  { id: "zeqou_code_sys", name: "Code — Systems", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/code_sys_8.json", builtin: true, lang: "code" },
  { id: "zeqou_code_ops", name: "Code — Ops & CLI", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/code_ops_9.json", builtin: true, lang: "code" },
  { id: "zeqou_sci_math", name: "Science — Math", size: 600, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/sci_math_10.json", builtin: true, lang: "sci" },
  { id: "zeqou_sci_phys", name: "Science — Physics", size: 600, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/sci_phys_11.json", builtin: true, lang: "sci" },
  { id: "zeqou_sci_school", name: "Science — School", size: 550, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/sci_school_12.json", builtin: true, lang: "sci" },
  { id: "zeqou_sci_cs", name: "Science — Computer Science", size: 550, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/sci_cs_13.json", builtin: true, lang: "sci" },
  { id: "zeqou_tech_mcp", name: "Tech — MCP", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/tech_mcp_14.json", builtin: true, lang: "tech" },
  { id: "zeqou_tech_tools", name: "Tech — Tools", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/tech_tools_15.json", builtin: true, lang: "tech" },
  { id: "zeqou_tech_info", name: "Tech — Info & DevOps", size: 600, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/tech_info_16.json", builtin: true, lang: "tech" },
  { id: "zeqou_external", name: "External scenarios (multi-language)", size: 300, format: "json", source: "builtin", path: "AIens/datasets/zeqou/parts/external_17.json", builtin: true, lang: "mix" },
  { id: "zeqou_add_ru", name: "Zeqou v1 add-on — Russian", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/v1add/d1_ru_500.json", builtin: true, lang: "RU" },
  { id: "zeqou_add_en", name: "Zeqou v1 add-on — English", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/v1add/d2_en_500.json", builtin: true, lang: "EN" },
  { id: "zeqou_add_es", name: "Zeqou v1 add-on — Spanish", size: 457, format: "json", source: "builtin", path: "AIens/datasets/zeqou/v1add/d3_es_500.json", builtin: true, lang: "ES" },
  { id: "zeqou_add_fr", name: "Zeqou v1 add-on — French", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/v1add/d4_fr_500.json", builtin: true, lang: "FR" },
  { id: "zeqou_add_de", name: "Zeqou v1 add-on — German", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/v1add/d5_de_500.json", builtin: true, lang: "DE" },
  { id: "zeqou_add_ja", name: "Zeqou v1 add-on — Japanese", size: 500, format: "json", source: "builtin", path: "AIens/datasets/zeqou/v1add/d7_ja_500.json", builtin: true, lang: "JA" },
];

/** All bundled datasets, the recommended default first. */
const BUILTIN_DATASETS: DatasetInfo[] = [...ZEQOU_BUILTINS, DEFAULT_BILINGUAL];

/** What runs when no dataset has been chosen. */
export const DEFAULT_DATASET_ID = "zeqou_v2";

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
    // Real scan: find every interpreter, honour the user's choice, probe torch.
    try {
      const check = await pythonEnv.quickCheck();
      return {
        available: check.available,
        version: check.available
          ? (check.detail || check.version || "Python found")
          : (check.detail || "No usable Python 3.10–3.13 found"),
        dependencies: { torch: check.hasTorch },
      };
    } catch {}
    const isTauri = isTauriEnv();
    if (!isTauri) {
      return { available: false, version: "Web mode — requires Tauri desktop for training", dependencies: {} };
    }
    return { available: false, version: "No Python 3.10–3.13 found — install Python 3.12 and rescan in Settings", dependencies: {} };
  },

  getBuiltinDatasets(): DatasetInfo[] {
    return BUILTIN_DATASETS;
  },

  async importDataset(path: string): Promise<DatasetInfo | null> {
    try {
      const filename = path.split(/[/\\]/).pop() || "dataset.json";
      // Count records with the *selected* interpreter via proc_start (the
      // shell-scope forbids "python"; the old stub silently caught the error).
      let size = 0;
      try {
        const { runProc } = await import("@/services/pythonEnv");
        const pyExe = pythonEnv.activeExecutable();
        if (pyExe) {
          const aiens = await invokeRust<string>("get_aiens_dir").catch(() => "AIens");
          const code = `import sys; sys.path.insert(0, r"${aiens.replace(/"/g, '')}"); from training_data import count_records_fast; print(count_records_fast(r"${path.replace(/"/g, '')}"))`;
          const out = await runProc(pyExe, ["-c", code], aiens, 20_000);
          const n = parseInt((out.stdout || "").trim().split(/\r?\n/).pop() || "0");
          if (!isNaN(n)) size = n;
        }
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
    return [...BUILTIN_DATASETS, ...loadDatasets()];
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
      // The chosen interpreter (venv if present) — never a guessed PATH name.
      const pyExe = pythonEnv.activeExecutable();
      if (!pyExe) {
        throw new Error("Python not configured — open Settings → Python & Training, pick an interpreter and install the ML runtime");
      }
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const { appDataDir, join } = await import("@tauri-apps/api/path");

      // AIens lives next to the app (dev) or in resources (installed build).
      let aiensDir = "AIens";
      try {
        aiensDir = await invokeRust<string>("get_aiens_dir");
      } catch {}

      // Resolve the dataset: a built-in id becomes its bundled path, a custom
      // entry its real path, and with nothing chosen the bundled default runs.
      let datasetPath = config.dataset_path || DEFAULT_DATASET_ID;
      if (datasetPath === "builtin") datasetPath = DEFAULT_DATASET_ID;
      const builtin = BUILTIN_DATASETS.find(d => d.id === datasetPath);
      if (builtin) datasetPath = builtin.path;
      const custom = loadDatasets().find(d => d.id === datasetPath || d.path === datasetPath);
      if (custom) datasetPath = custom.path;
      if (!/^(?:[A-Za-z]:[\\/]|\/)/.test(datasetPath)) {
        // Relative (builtin "AIens/datasets/...") — anchor it to the real AIens dir.
        datasetPath = `${aiensDir.replace(/[\\/]+$/, "")}/${datasetPath.replace(/^AIens[\\/]/, "")}`;
      }

      const jobId = `job_${Date.now()}`;
      currentJobId = jobId;

      const fullConfig = {
        ...config,
        dataset_path: datasetPath,
        aiens_dir: aiensDir,
        d_model: (config as any).d_model || 256,
        nhead: (config as any).nhead || 4,
      };

      // Create the job file directly — no python round-trip needed for JSON.
      const fsmod = await import("@tauri-apps/plugin-fs");
      const fs = fsmod as unknown as { mkdir: (p: string, o?: any) => Promise<void>; writeTextFile: (p: string, c: string) => Promise<void>; exists: (p: string) => Promise<boolean> };
      const jobsDir = await join(aiensDir, "training_jobs");
      try { await fs.mkdir(jobsDir, { recursive: true }); } catch {}
      const jobPath = await join(jobsDir, `${jobId}.json`);
      const modelOutDir = await join(aiensDir, "trained_models", config.name);
      const stopFile = await join(jobsDir, `${jobId}.stop`);
      // Absolute paths: the worker resolves dataset/output paths as-is, so a
      // relative "AIens/..." here would double up under cwd=AIens.
      await fs.writeTextFile(jobPath, JSON.stringify({
        id: jobId,
        output_dir: modelOutDir,
        config: fullConfig,
        stop_file: stopFile,
      }, null, 2));

      trainingProgress = { ...trainingProgress, progress: 5, message: `Запуск обучения (${pyExe.split(/[\\/]/).pop()})...` };
      notify();

      // Choose worker: lora_trainer.py for lora, training_worker.py for scratch.
      const workerName = config.mode === "lora" ? "lora_trainer.py" : "training_worker.py";
      let worker = await join(aiensDir, workerName);
      if (!(await fs.exists(worker))) worker = await join(aiensDir, "training_worker.py");

      // Stream the worker's JSON protocol lines into progress state.
      const unLog = await listen<[string, string]>("proc-log", (e) => {
        const [tag, line] = e.payload;
        if (tag !== jobId) return;
        try {
          const obj = JSON.parse(line);
          const d = obj.detail ?? obj;
          if (obj.event === "training-progress" || obj.event === "training-status") {
            trainingProgress = {
              progress: d.progress ?? trainingProgress.progress,
              step: d.step ?? trainingProgress.step,
              total_steps: d.total_steps ?? trainingProgress.total_steps,
              loss: typeof d.loss === "number" ? d.loss : trainingProgress.loss,
              epoch: d.epoch ?? trainingProgress.epoch,
              message: d.message || d.phase || trainingProgress.message,
            };
            notify();
          }
        } catch {
          // Plain stderr/log lines still update the message so the user sees life.
          if (line.trim()) {
            trainingProgress = { ...trainingProgress, message: line.trim().slice(0, 160) };
            notify();
          }
        }
      });

      // Run the worker with the SELECTED interpreter, wait for exit.
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        const unExit = listen<[string, number | null]>("proc-exit", (e) => {
          if (e.payload[0] === jobId) {
            unExit.then((f) => f());
            resolve(e.payload[1]);
          }
        });
        invoke<number>("proc_start", {
          id: jobId,
          program: pyExe,
          args: [worker, "--job", jobPath],
          cwd: aiensDir,
        }).then((pid) => { currentProcPid = pid; })
          .catch((err) => reject(err instanceof Error ? err : new Error(String(err))));
      });
      unLog();

      if (exitCode !== 0 && exitCode !== null) {
        throw new Error(`Тренер завершился с кодом ${exitCode} — подробности в сообщении выше`);
      }

      // If we reach here, training succeeded (or at least process exited 0)
      const model: TrainedModel = {
        id: `model_${Date.now()}`,
        name: config.name,
        train_mode: config.mode,
        base_model: config.base_model || "scratch",
        epochs: config.epochs,
        final_loss: trainingProgress.loss,
        size: "?",
        path: modelOutDir,
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
    // Kill the whole worker tree by pid (taskkill /T on Windows), plus the
    // stop-file handshake the trainers already understand.
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        if (currentProcPid) await invoke("proc_stop", { pid: currentProcPid });
      } catch {}
      try { await invokeRust("stop_training"); } catch {}
    })();
    trainingActive = false;
    currentProcPid = null;
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
