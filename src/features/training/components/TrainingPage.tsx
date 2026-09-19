import { useState, useEffect } from "react";
import { Brain, Play, Square, Trash2, Upload, Database, Settings2, BarChart3, BookOpen, CheckCircle2, AlertCircle, Clock, Plus, Languages, Code2, Eye, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/useStore";
import { cn } from "@/lib/utils";
import { trainingStore } from "../store/trainingStore";
import type { TrainingConfig, DatasetInfo, TrainedModel } from "@/services/training";
import { i18n } from "@/services/i18n";

export function TrainingPage() {
  const { trainingActive, trainingProgress, datasets, models } = useStore(
    trainingStore.subscribe,
    trainingStore.getState
  );
  const locale = useStore(i18n.subscribe, i18n.getLocale);

  const [envReady, setEnvReady] = useState<boolean | null>(null);
  const [envMessage, setEnvMessage] = useState(i18n.t("training.checking"));
  const [activeTab, setActiveTab] = useState<"train" | "models" | "datasets">("train");
  const [preview, setPreview] = useState<any[]>([]);

  const [config, setConfig] = useState<TrainingConfig>({
    name: "my_bilingual_model",
    mode: "scratch",
    dataset_path: "bilingual_aider_v1",
    epochs: 3,
    batch_size: 8,
    learning_rate: 0.0003,
    max_length: 128,
  });

  useEffect(() => {
    trainingStore.checkEnvironment().then((env) => {
      if (env.available) {
        setEnvReady(true);
        setEnvMessage(`Python ${env.version} ✓`);
      } else {
        setEnvReady(false);
        setEnvMessage(env.version || i18n.t("training.python_missing"));
      }
    });
    const ds = trainingStore.getDatasets().find(d => d.id === "bilingual_aider_v1");
    if (ds) {
      fetch("AIens/datasets/default_bilingual_aider_v1.json").then(r=>r.json()).then(data=>{
        if (Array.isArray(data)) setPreview(data.slice(0,3));
      }).catch(()=>{});
    }
  }, []);

  const handleStart = async () => {
    let dsPath = config.dataset_path;
    if (!dsPath) dsPath = "bilingual_aider_v1";
    if (dsPath === "bilingual_aider_v1") dsPath = "AIens/datasets/default_bilingual_aider_v1.json";
    else {
      const found = datasets.find(d => d.id === dsPath || d.path === dsPath);
      if (found) dsPath = found.path || dsPath;
    }
    await trainingStore.startTraining({ ...config, dataset_path: dsPath });
  };

  const handleImportDataset = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Datasets", extensions: ["json", "jsonl", "csv"] }],
      });
      if (selected) await trainingStore.importDataset(selected as string);
    } catch {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,.jsonl,.csv";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        await trainingStore.importDataset(file.name);
      };
      input.click();
    }
  };

  const allDatasets = trainingStore.getDatasets();

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="h-14 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Brain className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">{i18n.t("training.title")}</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Aider-style • bilingual EN/RU • LoRA & Scratch</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {envReady === null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 animate-spin" />{envMessage}</span>}
          {envReady === true && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{envMessage}</span>}
          {envReady === false && <span className="text-xs text-amber-600 flex items-center gap-1 max-w-[320px] truncate" title={envMessage}><AlertCircle className="h-3 w-3" />{envMessage}</span>}
        </div>
      </div>

      <div className="flex gap-1 px-6 pt-3 border-b shrink-0">
        {(["train", "datasets", "models"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all border-b-2",
              activeTab === tab ? "border-foreground text-foreground bg-secondary/50" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30")}>
            {tab === "train" ? i18n.t("training.tab_train") : tab === "datasets" ? i18n.t("training.tab_datasets") : i18n.t("training.tab_models")}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto">
          {activeTab === "train" && (
            <div className="space-y-6">
              {trainingActive && (
                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-foreground border-t-transparent rounded-full" />
                    <span className="text-sm font-medium">{i18n.t("training.running")}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{trainingProgress.message}</span>
                      <span className="font-mono font-medium">{trainingProgress.progress}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-foreground rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, trainingProgress.progress)}%` }} />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                      {trainingProgress.step > 0 && <span>{i18n.t("training.step", { a: trainingProgress.step, b: trainingProgress.total_steps })}</span>}
                      {trainingProgress.loss != null && <span>Loss: {trainingProgress.loss.toFixed(4)}</span>}
                      {trainingProgress.epoch > 0 && <span>{i18n.t("training.epoch", { n: trainingProgress.epoch })}</span>}
                    </div>
                  </div>
                </div>
              )}

              <div className="border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">{i18n.t("training.how_aider")}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {i18n.t("training.dataset_desc").replace(/<[^>]*>/g, "")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{i18n.t("training.config")}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">{i18n.t("training.model_name")}</label>
                    <Input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })}
                      placeholder="my_bilingual_model" className="text-sm h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">{i18n.t("training.mode")}</label>
                    <select value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="scratch">{i18n.t("training.mode_scratch")}</option>
                      <option value="lora">{i18n.t("training.mode_lora")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-medium">{i18n.t("training.dataset")}</label>
                    <select value={config.dataset_path} onChange={(e) => setConfig({ ...config, dataset_path: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="bilingual_aider_v1">{i18n.t("training.dataset_default")}</option>
                      {allDatasets.filter(d=> !d.builtin).map((ds) => (
                        <option key={ds.id} value={ds.path || ds.id}>{ds.name} ({ds.size} {locale === "ru" ? "примеров" : "samples"})</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{i18n.t("training.dataset_hint")}</p>
                  </div>
                  {config.mode === "lora" && (
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-medium">{i18n.t("training.base_model")}</label>
                      <Input value={config.base_model || ""} onChange={(e) => setConfig({ ...config, base_model: e.target.value })}
                        placeholder="Qwen/Qwen2.5-7B-Instruct" className="text-sm h-9" />
                      <p className="text-xs text-muted-foreground">
                        {locale === "ru"
                          ? "Hugging Face id, папка с config.json или своя обученная модель — адаптер объединится с весами базы, и обучение продолжится."
                          : "Hugging Face id, a folder with config.json, or your own trained model — the adapter is merged into the base weights and training continues."}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">{i18n.t("training.epochs")}</label>
                    <Input type="number" min={1} max={100} value={config.epochs}
                      onChange={(e) => setConfig({ ...config, epochs: parseInt(e.target.value) || 3 })}
                      className="text-sm h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Batch Size</label>
                    <Input type="number" min={1} max={256} value={config.batch_size}
                      onChange={(e) => setConfig({ ...config, batch_size: parseInt(e.target.value) || 8 })}
                      className="text-sm h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Learning Rate</label>
                    <Input type="number" min={0.00001} max={1} step={0.0001} value={config.learning_rate}
                      onChange={(e) => setConfig({ ...config, learning_rate: parseFloat(e.target.value) || 0.0003 })}
                      className="text-sm h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Max Length</label>
                    <Input type="number" min={16} max={2048} value={config.max_length}
                      onChange={(e) => setConfig({ ...config, max_length: parseInt(e.target.value) || 128 })}
                      className="text-sm h-9" />
                  </div>
                </div>

                {config.mode === "lora" && (
                  <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">LoRA Rank (r)</label>
                      <Input type="number" min={1} max={128} value={config.lora_r || 8}
                        onChange={(e) => setConfig({ ...config, lora_r: parseInt(e.target.value) || 8 })}
                        className="text-sm h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">LoRA Alpha</label>
                      <Input type="number" min={1} max={512} value={config.lora_alpha || 16}
                        onChange={(e) => setConfig({ ...config, lora_alpha: parseInt(e.target.value) || 16 })}
                        className="text-sm h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">{i18n.t("training.quantization")}</label>
                      <select value={config.quantization || "none"}
                        onChange={(e) => setConfig({ ...config, quantization: e.target.value as any })}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="none">{i18n.t("training.quant_none")}</option>
                        <option value="4bit">{i18n.t("training.quant_4bit")}</option>
                        <option value="8bit">8-bit</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 mt-4 border-t">
                  <Button size="sm" onClick={handleStart} disabled={trainingActive || !envReady}>
                    {trainingActive ? <><Square className="h-3.5 w-3.5 mr-1.5" /> {i18n.t("training.training")}</> : <><Play className="h-3.5 w-3.5 mr-1.5" /> {i18n.t("training.start")}</>}
                  </Button>
                  {trainingActive && (
                    <Button size="sm" variant="destructive" onClick={() => trainingStore.stopTraining()}>
                      <Square className="h-3.5 w-3.5 mr-1.5" />{i18n.t("training.stop")}
                    </Button>
                  )}
                </div>
              </div>

              {preview.length > 0 && (
                <div className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{i18n.t("training.preview")}</span>
                  </div>
                  <div className="space-y-2">
                    {preview.map((p, i) => (
                      <div key={i} className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-xs font-medium">{i18n.t("training.instruction", { t: p.instruction?.slice(0, 80) })}...</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.response?.slice(0, 120)}...</p>
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary">{p.lang} • {p.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "datasets" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{i18n.t("training.datasets", { n: allDatasets.length })}</h2>
                <Button size="sm" variant="outline" onClick={handleImportDataset}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> {i18n.t("training.upload")}
                </Button>
              </div>
              <div className="space-y-3">
                {allDatasets.map((ds) => (
                  <div key={ds.id} className={cn("border rounded-xl p-4 hover:shadow-sm transition-shadow", ds.builtin && "bg-secondary/30")}>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        ds.builtin ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground")}>
                        {ds.builtin ? <BookOpen className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-2">
                          {ds.name}
                          {ds.builtin && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary font-medium">{i18n.t("training.default_badge")}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {i18n.t("training.examples", { n: ds.size, f: ds.format, s: ds.source })} {ds.lang && `• ${ds.lang}`}
                        </p>
                      </div>
                      {!ds.builtin && (
                        <button onClick={() => trainingStore.removeDataset(ds.id)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "models" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">{i18n.t("training.trained_models", { n: models.length })}</h2>
              {models.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-xl">
                  <Brain className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm font-medium">{i18n.t("training.no_models")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{i18n.t("training.no_models_hint")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {models.map((m) => (
                    <div key={m.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Brain className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.train_mode} • base: {m.base_model || "scratch"} • {i18n.t("training.epochs_suffix", { n: m.epochs })}
                            {m.final_loss != null && ` • loss: ${m.final_loss}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.created ? new Date(m.created).toLocaleString() : ""}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("px-2 py-1 rounded-full text-xs font-medium",
                            m.status.includes("ready") ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground")}>
                            {m.status}
                          </span>
                          <button
                            onClick={() => {
                              setConfig({ ...config, base_model: m.path, name: `${m.name}-continued` });
                              setActiveTab("train");
                            }}
                            title={locale === "ru"
                              ? "Дообучить эту модель: адаптер объединяется с весами базовой модели, и обучение продолжается"
                              : "Fine-tune this model further: the adapter is merged into the base weights and training continues"}
                            className="h-8 px-2.5 flex items-center gap-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            <RefreshCw className="h-3.5 w-3.5" />
                            {locale === "ru" ? "Дообучить" : "Continue"}
                          </button>
                          <button onClick={() => trainingStore.deleteModel(m.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
