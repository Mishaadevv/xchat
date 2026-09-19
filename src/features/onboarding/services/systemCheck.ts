import type { LocalModel } from "../data/localModels";

export type GpuVendor = "nvidia" | "apple" | "amd" | "intel" | "unknown";

export interface SystemInfo {
  cores: number | null;
  /** Total RAM, GB. deviceMemory is Chromium-only — null when unknown. */
  ramGB: number | null;
  ramKnown: boolean;
  gpu: string | null;
  gpuVendor: GpuVendor;
  /** Is an Ollama server reachable on localhost:11434? */
  ollama: boolean;
  ollamaChecked: boolean;
  downloadPath: string;
}

export type Fit = "fits" | "tight" | "no" | "unknown";

export interface FitResult {
  fit: Fit;
  lines: { ru: string; en: string }[];
}

function detectGpu(): { gpu: string | null; vendor: GpuVendor } {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) return { gpu: null, vendor: "unknown" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "")
      : gl.getParameter(gl.RENDERER);
    const name = (raw || "").trim() || null;
    const lower = (name || "").toLowerCase();
    const vendor: GpuVendor = lower.includes("nvidia") || lower.includes("geforce") || lower.includes("rtx")
      ? "nvidia"
      : lower.includes("apple") || lower.includes("m1") || lower.includes("m2") || lower.includes("m3") || lower.includes("m4")
        ? "apple"
        : lower.includes("amd") || lower.includes("radeon")
          ? "amd"
          : lower.includes("intel")
            ? "intel"
            : "unknown";
    return { gpu: name, vendor };
  } catch {
    return { gpu: null, vendor: "unknown" };
  }
}

async function probeOllama(timeoutMs = 2500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("http://localhost:11434/api/tags", { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function collectSystemInfo(): Promise<SystemInfo> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ramGB = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const { gpu, vendor } = detectGpu();
  const ollama = await probeOllama();
  let downloadPath = "";
  try {
    const raw = localStorage.getItem("zeqouxchat-settings");
    if (raw) downloadPath = JSON.parse(raw).downloadPath || "";
  } catch {}
  return {
    cores: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
    ramGB,
    ramKnown: ramGB !== null,
    gpu,
    gpuVendor: vendor,
    ollama,
    ollamaChecked: true,
    downloadPath,
  };
}

/** Verdict for one model on this machine. Honest about unknowns. */
export function fitFor(model: LocalModel, sys: SystemInfo): FitResult {
  const lines: { ru: string; en: string }[] = [];
  let fit: Fit;

  if (!sys.ramKnown) {
    fit = "unknown";
    lines.push({
      ru: `Нужно ~${model.minRamGB} ГБ RAM — объём памяти определить не удалось, сверьтесь сами.`,
      en: `Needs ~${model.minRamGB} GB RAM — could not detect memory, please check yourself.`,
    });
  } else if ((sys.ramGB as number) >= model.minRamGB) {
    fit = "fits";
    lines.push({
      ru: `RAM хватает (${sys.ramGB} ГБ+ против нужных ~${model.minRamGB} ГБ).`,
      en: `Enough RAM (${sys.ramGB} GB+ vs ~${model.minRamGB} GB needed).`,
    });
  } else if ((sys.ramGB as number) >= model.minRamGB - 2) {
    fit = "tight";
    lines.push({
      ru: `Впритык: ${sys.ramGB} ГБ при нужных ~${model.minRamGB} ГБ — закройте тяжёлые программы.`,
      en: `Tight: ${sys.ramGB} GB vs ~${model.minRamGB} GB needed — close heavy apps first.`,
    });
  } else {
    fit = "no";
    lines.push({
      ru: `Не потянет: ${sys.ramGB} ГБ RAM против нужных ~${model.minRamGB} ГБ.`,
      en: `Won't fit: ${sys.ramGB} GB RAM vs ~${model.minRamGB} GB needed.`,
    });
  }

  if (sys.gpuVendor === "intel" && fit !== "no") {
    lines.push({
      ru: "Встроенная графика Intel — считайте на CPU-режим, будет медленно.",
      en: "Intel integrated graphics — expect CPU mode, it will be slow.",
    });
  }
  if (!sys.ollama) {
    lines.push({
      ru: "Ollama не найдена — файл скачается, а для запуска поставьте Ollama или LM Studio.",
      en: "Ollama not found — the file will download, but install Ollama or LM Studio to run it.",
    });
  }
  if (model.note) lines.push(model.note);

  return { fit, lines };
}
