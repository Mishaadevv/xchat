/**
 * Serving trained models to the chat screen.
 *
 * A trained scratch model is not a llama.cpp GGUF — it needs our own runtime.
 * We ship a small OpenAI-compatible HTTP server (AIens/served_model.py) that
 * loads the model through trained_inference and speaks the dialect the chat
 * already understands. The server runs on the SELECTED interpreter (venv if
 * present) via proc_start, bound to 127.0.0.1 only.
 */
import { pythonEnv } from "./pythonEnv";
import { providerService } from "./providers";

export const TRAINED_SERVING_PORT = 48219;
const PROVIDER_ID = "zeqou-trained";
const BASE_URL = `http://127.0.0.1:${TRAINED_SERVING_PORT}/v1`;

export interface ServingStatus {
  /** Model dir currently being served (null = nothing running). */
  serving: string | null;
  /** Model name shown in the provider label. */
  name: string | null;
  pid: number | null;
  port: number;
}

let state: ServingStatus = { serving: null, name: null, pid: null, port: TRAINED_SERVING_PORT };
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<ServingStatus>) {
  state = { ...state, ...patch };
  notify();
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import("@tauri-apps/api/core");
  return core.invoke<T>(cmd, args);
}

/** Absolute path of the AIens folder (falls back to the dev-relative name). */
async function aiensDir(): Promise<string> {
  try {
    return await invokeTauri<string>("get_aiens_dir");
  } catch {
    return "AIens";
  }
}

export const trainedServing = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getState: () => state,

  /** True when the local serving endpoint answers /health. */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${state.port}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Start serving a trained model dir on the selected interpreter.
   * Resolves {ok:false, error} instead of throwing so the UI can show it.
   */
  async start(modelPath: string, modelName: string): Promise<{ ok: boolean; error?: string }> {
    if (!modelPath) return { ok: false, error: "no model path" };
    const { isTauri } = await import("@/lib/platform");
    if (!isTauri()) return { ok: false, error: "Desktop app required" };

    try {
      await this.stop();

      const pyExe = pythonEnv.activeExecutable();
      if (!pyExe) {
        return { ok: false, error: "Python not configured — Settings → Python & Training" };
      }

      const dir = await aiensDir();
      const worker = `${dir.replace(/[\\/]+$/, "")}/served_model.py`;
      const id = `trained-serving-${Date.now()}`;
      const pid = await invokeTauri<number>("proc_start", {
        id,
        program: pyExe,
        args: [worker, "--model-dir", modelPath, "--port", String(TRAINED_SERVING_PORT)],
        cwd: dir,
      });
      set({ pid });

      // Poll /health until the model is loaded (cold start can take a while).
      const deadline = Date.now() + 60_000;
      let healthy = false;
      while (Date.now() < deadline) {
        if (await this.isHealthy()) {
          healthy = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!healthy) {
        await this.stop();
        return { ok: false, error: "Serving did not become healthy in 60s — model may be incompatible" };
      }

      set({ serving: modelPath, name: modelName });
      this.attachToProviders(modelName, modelPath);
      return { ok: true };
    } catch (err) {
      set({ pid: null, serving: null, name: null });
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async stop(): Promise<void> {
    if (state.pid) {
      try {
        await invokeTauri("proc_stop", { pid: state.pid });
      } catch {}
    }
    set({ pid: null, serving: null, name: null });
    this.detachProviders();
  },

  /**
   * Register/update the `zeqou-trained` provider and point it at the model.
   * The chat stores provider+model per chat, so the caller must also select
   * them via chatStore before the next message.
   */
  attachToProviders(modelName: string, modelPath: string): void {
    providerService.updateProvider(PROVIDER_ID, {
      id: PROVIDER_ID,
      name: `Zeqou Trained (${modelName})`,
      type: "openai",
      apiKey: "local",
      baseUrl: BASE_URL,
      models: [modelPath],
      category: "local",
    });
  },

  /** Empty the provider's model list when serving stops. */
  detachProviders(): void {
    try {
      providerService.updateProvider(PROVIDER_ID, { models: [] });
    } catch {}
  },
};
