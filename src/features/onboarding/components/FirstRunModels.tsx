import { useEffect, useReducer, useState } from "react";
import {
  AlertTriangle,
  Check,
  Cpu,
  Download,
  FolderOpen,
  Loader2,
  MemoryStick,
  Monitor,
  Server,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCAL_MODELS } from "../data/localModels";
import { onboardingStore } from "../services/onboardingStore";
import {
  collectSystemInfo,
  fitFor,
  type Fit,
  type SystemInfo,
} from "../services/systemCheck";
import { downloadService, getDownloadedModels } from "@/services/downloads";
import { downloadEngine, installEngineFromZip, installVCRedist, localRuntime, pickEngineAsset } from "@/services/localRuntime";
import { openUrl } from "@/lib/platform";
import { chatStore } from "@/features/chat/store/chatStore";
import { settingsStore } from "@/services/settingsStore";
import { i18n } from "@/services/i18n";
import { useStore } from "@/lib/useStore";

const STR = {
  ru: {
    title: "Заберите бесплатную ИИ-модель",
    subtitle:
      "Эти модели работают полностью на вашем компьютере — без подписок и интернета после скачивания. Проверьте систему и заберите любую одной кнопкой. Можно отказаться.",
    system: "Ваша система",
    cpu: "CPU",
    cores: "ядер",
    ram: "RAM",
    unknown: "неизвестно",
    gpu: "GPU",
    runtime: "Ollama",
    runtimeFound: "найдена",
    runtimeMissing: "не найдена",
    runtimeHint: "Файл скачается, а для запуска поставьте Ollama или LM Studio",
    folder: "Папка для моделей",
    notChosen: "не выбрана",
    choose: "Выбрать папку",
    download: "Скачать",
    downloading: "Качается",
    cancel: "Отмена",
    downloaded: "Скачано",
    showFile: "Показать файл",
    resolving: "Ищу файл…",
    needPath: "Сначала выберите папку для моделей",
    noGguf: "GGUF не найден в репозитории",
    skip: "Продолжить без моделей",
    reopen: "Вернуться сюда можно позже: Загрузки → Рекомендуемые",
    fits: "Подойдёт",
    tight: "Впритык",
    no: "Не потянет",
    unknownFit: "ХЗ, проверьте",
    needs: "Нужно",
    free: "Бесплатно навсегда",
    engine: "Встроенный движок",
    engineMissing: "нет файла движка",
    engineStopped: "остановлен",
    engineStarting: "запуск…",
    engineRunning: "работает",
    engineError: "ошибка",
    engineHint: "Без Ollama и LM Studio: скачайте модель и нажмите «Запустить» — движок уже внутри приложения. Файл движка для сборки: src-tauri/binaries/README.md",
    start: "Запустить",
    stop: "Остановить",
    openChat: "Открыть чат",
    downloadEngine: "Скачать движок",
    engineResolving: "Подбираю сборку…",
    pickZip: "Выбрать zip",
    openReleases: "Страница релизов",
    zipHint: "Не качается само? Скачайте zip в браузере и укажите файл — приложение распакует движок само.",
    retry: "Повторить",
    showLog: "Показать лог",
    redownload: "Скачать заново",
    installVCRedist: "Установить VCRedist",
    vcredistHint: "Код 0xC0000135 = нет системных библиотек Microsoft. Скачаю и запущу официальный установщик — подтвердите в окне Windows, потом жмите Запустить.",
    vcredistLaunched: "Установщик запущен — дождитесь конца установки и жмите Запустить.",
  },
  en: {    title: "Claim a free AI model",
    subtitle:
      "These models run entirely on your computer — no subscriptions, no internet needed after download. Check your system and grab any with one button. You can skip this.",
    system: "Your system",
    cpu: "CPU",
    cores: "cores",
    ram: "RAM",
    unknown: "unknown",
    gpu: "GPU",
    runtime: "Ollama",
    runtimeFound: "found",
    runtimeMissing: "not found",
    runtimeHint: "The file will download, but install Ollama or LM Studio to run it",
    folder: "Models folder",
    notChosen: "not chosen",
    choose: "Choose folder",
    download: "Download",
    downloading: "Downloading",
    cancel: "Cancel",
    downloaded: "Downloaded",
    showFile: "Show file",
    resolving: "Resolving file…",
    needPath: "Choose a models folder first",
    noGguf: "No GGUF found in the repository",
    skip: "Continue without models",
    reopen: "You can come back later: Downloads → Recommended",
    fits: "Fits",
    tight: "Tight",
    no: "Won't fit",
    unknownFit: "Unknown, check",
    needs: "Needs",
    free: "Free forever",
    engine: "Built-in engine",
    engineMissing: "engine binary missing",
    engineStopped: "stopped",
    engineStarting: "starting…",
    engineRunning: "running",
    engineError: "error",
    engineHint: "No Ollama or LM Studio needed: download a model and press Start — the engine ships inside the app. Engine file for builds: src-tauri/binaries/README.md",
    start: "Start",
    stop: "Stop",
    openChat: "Open chat",
    downloadEngine: "Download engine",
    engineResolving: "Picking a build…",
    pickZip: "Pick zip",
    openReleases: "Releases page",
    zipHint: "Auto-download failing? Grab the zip in your browser and point the app at it — it will unpack the engine itself.",
    retry: "Retry",
    showLog: "Show log",
    redownload: "Re-download",
    installVCRedist: "Install VCRedist",
    vcredistHint: "Code 0xC0000135 = missing Microsoft system libraries. I'll fetch and launch the official installer — confirm the Windows prompt, then press Start.",
    vcredistLaunched: "Installer launched — wait for it to finish, then press Start.",
  },
} as const;

const FIT_STYLE: Record<Fit, string> = {
  fits: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  tight: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  no: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  unknown: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const FIT_KEY: Record<Fit, "fits" | "tight" | "no" | "unknownFit"> = {
  fits: "fits",
  tight: "tight",
  no: "no",
  unknown: "unknownFit",
};

export function FirstRunModels() {
  const locale = useStore(i18n.subscribe, i18n.getLocale);
  const t = STR[locale === "ru" ? "ru" : "en"];
  const rt = useStore(localRuntime.subscribe, localRuntime.getState);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [entryByModel, setEntryByModel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errorByModel, setErrorByModel] = useState<Record<string, string>>({});
  const [engineBusy, setEngineBusy] = useState(false);
  const [engineLabel, setEngineLabel] = useState("");
  const [engineError, setEngineError] = useState("");
  const [vcBusy, setVcBusy] = useState(false);
  const [vcMsg, setVcMsg] = useState("");

  useEffect(() => {
    let alive = true;
    collectSystemInfo().then((info) => {
      if (alive) setSys(info);
    });
    localRuntime.probe().catch(() => {});
    const unsub = downloadService.subscribe(force);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const pickFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        settingsStore.setDownloadPath(selected);
        setSys((prev) => (prev ? { ...prev, downloadPath: selected } : prev));
      }
    } catch {}
  };

  const handleDownload = async (modelId: string, repo: string, preferredFile?: string) => {
    if (!sys?.downloadPath) {
      setErrorByModel((p) => ({ ...p, [modelId]: t.needPath }));
      return;
    }
    setBusy((p) => ({ ...p, [modelId]: true }));
    setErrorByModel((p) => ({ ...p, [modelId]: "" }));
    try {
      const res = await downloadService.startSmartDownload(modelId, repo, preferredFile);
      if (res.error === "no-path") {
        setErrorByModel((p) => ({ ...p, [modelId]: t.needPath }));
      } else if (res.error === "no-gguf") {
        setErrorByModel((p) => ({ ...p, [modelId]: t.noGguf }));
      } else if (res.entryId) {
        setEntryByModel((p) => ({ ...p, [modelId]: res.entryId as string }));
      }
    } finally {
      setBusy((p) => ({ ...p, [modelId]: false }));
    }
  };

  const downloaded = getDownloadedModels();
  const entries = downloadService.getDownloads();

  const displayNameOf = (file: string) => file.replace(/\.gguf$/i, "");

  const handleStart = async (modelId: string) => {
    const file = downloaded[modelId];
    if (!file) return;
    setErrorByModel((p) => ({ ...p, [modelId]: "" }));
    const gpuLayers = sys && (sys.gpuVendor === "nvidia" || sys.gpuVendor === "apple") ? 999 : 0;
    const ok = await localRuntime.start(file.path, { gpuLayers, displayName: displayNameOf(file.file) });
    if (ok) {
      const name = displayNameOf(file.file);
      chatStore.setProvider("llamacpp");
      chatStore.setModel(name);
      try {
        localStorage.setItem("zeqouxchat-last-model", JSON.stringify({ model: name, provider: "llamacpp" }));
      } catch {}
    } else if (localRuntime.getState().status === "missing") {
      setErrorByModel((p) => ({ ...p, [modelId]: t.engineHint }));
    }
  };

  const handleOpenChat = () => onboardingStore.complete();

  const handleEngineDownload = async () => {
    setEngineBusy(true);
    setEngineError("");
    setEngineLabel(t.engineResolving);
    try {
      const asset = await pickEngineAsset();
      setEngineLabel(`${asset.name} (${(asset.size / 1024 / 1024).toFixed(0)} МБ)`);
      await downloadEngine();
      await localRuntime.probe();
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : "Failed");
      setEngineLabel("");
    } finally {
      setEngineBusy(false);
    }
  };

  const handleVCRedist = async () => {
    setVcBusy(true);
    setVcMsg("");
    try {
      await installVCRedist();
      setVcMsg(t.vcredistLaunched);
    } catch (err) {
      setVcMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setVcBusy(false);
    }
  };
  const handlePickZip = async () => {
    setEngineError("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Engine", extensions: ["zip"] }],
      });
      if (typeof selected !== "string" || !selected) return;
      setEngineBusy(true);
      setEngineLabel(selected.split("\\").pop()?.split("/").pop() || selected);
      await installEngineFromZip(selected);
      await localRuntime.probe();
      setEngineLabel("");
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : "Failed");
    } finally {
      setEngineBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t.title}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                {t.subtitle}
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 shrink-0">
              {t.free}
            </span>
          </div>

          {/* System strip */}
          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
              {t.system}
            </p>
            {!sys ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />…
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {sys.cores !== null ? `${sys.cores} ${t.cores}` : t.unknown}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {sys.ramKnown ? `${sys.ramGB} ГБ RAM` : `RAM: ${t.unknown}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0" title={sys.gpu || ""}>
                  <Monitor className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="text-zinc-700 dark:text-zinc-300 truncate">
                    {sys.gpu || t.unknown}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className={sys.ollama ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>
                    {sys.ollama ? t.runtimeFound : t.runtimeMissing}
                  </span>
                </div>
                <div className="flex items-center gap-2" title={rt.message || ""}>
                  <Sparkles className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className={cn(
                    rt.status === "running" ? "text-emerald-600 dark:text-emerald-400" :
                    rt.status === "error" || rt.status === "missing" ? "text-amber-600 dark:text-amber-400" :
                    "text-zinc-500"
                  )}>
                    {t.engine}: {t[
                      rt.status === "missing" ? "engineMissing" :
                      rt.status === "stopped" ? "engineStopped" :
                      rt.status === "starting" ? "engineStarting" :
                      rt.status === "running" ? "engineRunning" : "engineError"
                    ]}
                  </span>
                </div>
              </div>
            )}
            {sys && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 space-y-1">
                <p>{t.engineHint}</p>
                {!sys.ollama && rt.status === "missing" && (
                  <p>
                    {t.runtimeHint} —{" "}
                    <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                      ollama.com
                    </a>
                  </p>
                )}
                {(rt.status === "error" || rt.status === "starting") && rt.message && (
                  <p className={rt.status === "error" ? "text-rose-600" : ""}>{rt.message}</p>
                )}
                {rt.log.length > 0 && (rt.status === "error" || rt.status === "starting") && (
                  <details>
                    <summary className="cursor-pointer text-violet-600 hover:underline">{t.showLog}</summary>
                    <pre className="mt-1 p-2 rounded-lg bg-zinc-950 text-zinc-300 text-[11px] leading-relaxed overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {rt.log.slice(-12).join("\n")}
                    </pre>
                  </details>
                )}
              </div>
            )}
            {/* Folder */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <FolderOpen className="h-4 w-4 text-zinc-400 shrink-0" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex-1">
                {t.folder}: {sys?.downloadPath || <span className="text-amber-600">{t.notChosen}</span>}
              </span>
              <button
                onClick={pickFolder}
                className="text-xs font-medium text-violet-600 hover:text-violet-700 shrink-0"
              >
                {t.choose}
              </button>
            </div>
            {/* Built-in engine download / reinstall */}
            {(rt.status === "missing" || rt.status === "error") && (
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 flex-1">
                    {engineLabel || t.engine}
                  </span>
                  {rt.message.includes("0xC0000135") && (
                    <button
                      onClick={handleVCRedist}
                      disabled={engineBusy || vcBusy}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                    >
                      {vcBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {t.installVCRedist}
                    </button>
                  )}
                  <button
                    onClick={handleEngineDownload}
                    disabled={engineBusy || vcBusy}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 shrink-0"
                  >
                    {engineBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {rt.status === "error" ? t.redownload : t.downloadEngine}
                  </button>
                </div>
                {vcMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{vcMsg}</p>}
                {engineBusy && rt.engineProgress > 0 && (
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all"
                      style={{ width: `${rt.engineProgress}%` }}
                    />
                  </div>
                )}
                {engineError && (
                  <div className="mt-2">
                    <p className="text-xs text-rose-600">{engineError}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t.zipHint}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        onClick={handleEngineDownload}
                        disabled={engineBusy}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-violet-500 transition-colors disabled:opacity-50"
                      >
                        {t.retry}
                      </button>
                      <button
                        onClick={handlePickZip}
                        disabled={engineBusy}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-violet-500 transition-colors disabled:opacity-50"
                      >
                        {t.pickZip}
                      </button>
                      <button
                        onClick={() => openUrl("https://github.com/ggml-org/llama.cpp/releases")}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-violet-500 transition-colors"
                      >
                        {t.openReleases}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Models */}
          <div className="mt-4 space-y-3">
            {LOCAL_MODELS.map((model) => {
              const fit = sys ? fitFor(model, sys) : null;
              const file = downloaded[model.id];
              const entryId = entryByModel[model.id];
              const entry = entryId ? entries.find((e) => e.id === entryId) : undefined;
              const downloading = entry?.status === "downloading";
              const isBusy = busy[model.id];
              const err = errorByModel[model.id];

              return (
                <div
                  key={model.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-900 dark:text-white">{model.name}</span>
                        {fit && (
                          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", FIT_STYLE[fit.fit])}>
                            {t[FIT_KEY[fit.fit]]}
                          </span>
                        )}
                        <span className="text-xs text-zinc-400">
                          ~{model.sizeGB} ГБ · {t.needs} {model.minRamGB} ГБ RAM
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                        {model.tagline[locale === "ru" ? "ru" : "en"]}
                      </p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {model.tags.map((tag) => (
                          <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {fit && (
                        <ul className="mt-2 space-y-1">
                          {fit.lines.map((line, i) => (
                            <li key={i} className="text-xs text-zinc-500 dark:text-zinc-400 flex gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px text-zinc-400" />
                              {line[locale === "ru" ? "ru" : "en"]}
                            </li>
                          ))}
                        </ul>
                      )}
                      {err && <p className="text-xs text-rose-600 mt-2">{err}</p>}
                      {entry && downloading && (
                        <div className="mt-3">
                          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all"
                              style={{ width: `${entry.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            {entry.progress}% · {entry.downloadedSize} / {entry.totalSize} · {entry.speed}
                          </p>
                        </div>
                      )}
                      {file && !downloading && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5" />
                          {file.file}
                          {rt.status === "running" && rt.modelPath === file.path && (
                            <span className="text-violet-600 dark:text-violet-400">· {t.engineRunning}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col gap-2 items-end">
                      {file && !downloading ? (
                        <>
                          {rt.status === "running" && rt.modelPath === file.path ? (
                            <>
                              <button
                                onClick={() => localRuntime.stop()}
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:opacity-90"
                              >
                                <X className="h-3.5 w-3.5" /> {t.stop}
                              </button>
                              <button
                                onClick={handleOpenChat}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-violet-600 text-white hover:bg-violet-700"
                              >
                                {t.openChat}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStart(model.id)}
                                disabled={rt.status === "starting"}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50"
                              >
                                {rt.status === "starting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                {rt.status === "starting" ? t.engineStarting : t.start}
                              </button>
                              <button
                                onClick={() => downloadService.revealFile(file.path)}
                                className="text-xs font-medium px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 hover:border-violet-500 transition-colors"
                              >
                                {t.showFile}
                              </button>
                            </>
                          )}
                        </>
                      ) : downloading && entry ? (
                        <button
                          onClick={() => downloadService.cancel(entry.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:opacity-90"
                        >
                          <X className="h-3.5 w-3.5" /> {t.cancel}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(model.id, model.hfRepo, model.preferredFile)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {isBusy ? t.resolving : t.download}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={() => onboardingStore.complete()}
              className="text-sm font-medium px-6 py-2.5 rounded-full bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              {t.skip}
            </button>
            <p className="text-xs text-zinc-400">{t.reopen}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
