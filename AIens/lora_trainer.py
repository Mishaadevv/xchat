import json
import re
import time
from pathlib import Path

from training_data import extract_lora_texts, load_records


def _resolve_base_from_adapter(base_model: str, emit):
    """Resolve the real base model when the given source is a PEFT adapter.

    Any model trained here as LoRA/QLoRA is an adapter on top of a base; loading
    such a folder directly fails because it has no config.json. Point training
    at it and it continues from there: the base is loaded, the adapter is merged
    into the weights, and a new adapter is trained on the result. Works for any
    adapter folder, not only models trained by this app.
    """
    folder = Path(base_model)
    adapter_config_path = folder / "adapter_config.json"
    if not adapter_config_path.is_file():
        return base_model
    try:
        adapter_config = json.loads(adapter_config_path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        adapter_config = {}
    base = str(adapter_config.get("base_model_name_or_path") or "").strip()
    if not base:
        raise ValueError(
            f"'{base_model}' is a LoRA adapter without base_model_name_or_path; "
            "the base model it was trained on cannot be determined."
        )
    if not (Path(base).is_dir() or re.match(r"^[\w.\-]+/[\w.\-]+$", base)):
        raise ValueError(f"The adapter's base model '{base}' is not a valid model id or folder.")
    emit("training-status", {
        "message": (
            f"'{folder.name}' is a LoRA adapter on top of '{base}'. Loading the base "
            "model, merging the adapter into the weights, then attaching a new adapter."
        ),
        "phase": "adapter_merge",
    })
    return base


def _detect_target_modules(model):
    try:
        import torch.nn as nn

        names = {n.split(".")[-1] for n, m in model.named_modules() if isinstance(m, nn.Linear)}
    except Exception:
        names = set()

    candidates = [
        ["q_proj", "v_proj"],
        ["query", "value"],
        ["c_attn"],
        ["q_proj", "k_proj", "v_proj", "o_proj"],
        ["query_key_value"],
        ["dense"],
    ]
    for group in candidates:
        if any(x in names for x in group):
            return [x for x in group if x in names] or group[:1]

    fallback = [n.split(".")[-1] for n, m in model.named_modules() if type(m).__name__ == "Linear"]
    return list(dict.fromkeys(fallback[:2])) if fallback else ["q_proj", "v_proj"]


class _StopByUser(Exception):
    pass


def train_lora(config: dict, output_dir: str, emit, stop_requested):
    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            DataCollatorForLanguageModeling,
            Trainer,
            TrainerCallback,
            TrainingArguments,
        )
    except Exception as e:
        raise RuntimeError(f"LoRA runtime import failed: {e}")

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    dataset_path = config.get("dataset_path")
    if not dataset_path:
        raise ValueError("dataset_path is required")

    emit("training-status", {"message": "Loading dataset...", "phase": "dataset"})
    records = load_records(dataset_path)
    texts = [t for t in extract_lora_texts(records) if t.strip()]
    if not texts:
        raise ValueError("No trainable text samples found in dataset")

    base_model = config.get("base_model")
    if not base_model:
        raise ValueError("base_model is required for LoRA mode")
    # A trained model folder may itself be a LoRA adapter; resolve it to its
    # base so training continues from the merged weights.
    adapter_source = base_model
    base_model = _resolve_base_from_adapter(base_model, emit)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    emit("training-status", {"message": f"Device: {device.upper()}", "phase": "device"})

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True, padding_side="right")
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quantization = str(config.get("quantization", "none")).lower()
    use_4bit = bool(config.get("use_4bit", False)) or quantization == "4bit"
    use_8bit = bool(config.get("use_8bit", False)) or quantization == "8bit"
    use_quant = (use_4bit or use_8bit) and device == "cuda"
    if use_quant and Path(adapter_source).is_dir() and adapter_source != base_model:
        # merge_and_unload cannot fold an adapter into bitsandbytes-quantized
        # weights, so a merged continuation runs in full precision instead.
        emit("training-status", {
            "message": "Quantization is skipped when continuing from a merged adapter; training runs in full precision.",
            "phase": "warning",
        })
        use_quant = use_4bit = use_8bit = False

    bnb_cfg = None
    if use_quant:
        try:
            from transformers import BitsAndBytesConfig

            if use_4bit:
                bnb_cfg = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_use_double_quant=True,
                )
            else:
                bnb_cfg = BitsAndBytesConfig(load_in_8bit=True)
        except Exception:
            emit("training-status", {"message": "bitsandbytes unavailable, fallback to standard precision", "phase": "warning"})
            use_quant = False

    emit("training-status", {"message": f"Loading base model: {base_model}", "phase": "model_loading"})
    load_kwargs = {"trust_remote_code": True}
    if device == "cuda":
        load_kwargs["device_map"] = "auto"
    if bnb_cfg is not None:
        load_kwargs["quantization_config"] = bnb_cfg
    elif device == "cuda":
        load_kwargs["torch_dtype"] = torch.float16

    model = AutoModelForCausalLM.from_pretrained(base_model, **load_kwargs)
    if device == "cpu":
        model = model.to("cpu")

    # Continue from a previously trained adapter: fold it into the weights so
    # the new adapter starts where the last run stopped.
    if Path(adapter_source).is_dir() and adapter_source != base_model:
        from peft import PeftModel

        emit("training-status", {"message": f"Merging the trained adapter from {adapter_source}", "phase": "adapter_merge"})
        model = PeftModel.from_pretrained(model, adapter_source)
        model = model.merge_and_unload()

    if use_quant:
        model = prepare_model_for_kbit_training(model)

    target_modules = _detect_target_modules(model)
    lora_cfg = LoraConfig(
        r=int(config.get("lora_r", 8)),
        lora_alpha=int(config.get("lora_alpha", 16)),
        lora_dropout=float(config.get("lora_dropout", 0.05)),
        target_modules=target_modules,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    model = get_peft_model(model, lora_cfg)

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    emit(
        "training-status",
        {
            "message": f"LoRA ready: trainable {trainable:,}/{total:,} ({100 * trainable / max(1, total):.2f}%)",
            "phase": "model_ready",
        },
    )

    max_length = int(config.get("max_length", 256))

    def tokenize(batch):
        enc = tokenizer(batch["text"], truncation=True, max_length=max_length, padding="max_length")
        enc["labels"] = [ids[:] for ids in enc["input_ids"]]
        return enc

    ds = Dataset.from_dict({"text": texts})
    tok_ds = ds.map(tokenize, batched=True, remove_columns=["text"])

    if len(tok_ds) >= 10:
        split = tok_ds.train_test_split(test_size=0.1, seed=42)
        train_ds, eval_ds = split["train"], split["test"]
    else:
        train_ds, eval_ds = tok_ds, None

    batch_size = int(config.get("batch_size", 2))
    grad_acc = max(1, int(config.get("gradient_accumulation", 4)))
    epochs = int(config.get("epochs", 3))

    steps_per_epoch = max(1, len(train_ds) // max(1, batch_size * grad_acc))
    total_steps = max(1, steps_per_epoch * epochs)
    started = time.time()
    history = {"loss": [], "lr": [], "epoch": [], "step": []}

    use_fp16 = (device == "cuda") and not use_4bit and not use_8bit
    optim = "paged_adamw_8bit" if use_quant else "adamw_torch"

    args = TrainingArguments(
        output_dir=str(out),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        gradient_accumulation_steps=grad_acc,
        learning_rate=float(config.get("learning_rate", 2e-4)),
        weight_decay=float(config.get("weight_decay", 0.01)),
        warmup_ratio=float(config.get("warmup_ratio", 0.03)),
        lr_scheduler_type=str(config.get("lr_scheduler", "linear")),
        fp16=use_fp16,
        optim=optim,
        logging_steps=1,
        save_steps=max(20, total_steps // 5),
        save_total_limit=2,
        evaluation_strategy="epoch" if eval_ds is not None else "no",
        load_best_model_at_end=bool(eval_ds),
        report_to="none",
        dataloader_num_workers=0,
    )

    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    class _ProgressCallback(TrainerCallback):
        def on_log(self, args, state, control, logs=None, **kwargs):
            if logs is None:
                return
            if stop_requested():
                control.should_training_stop = True
                return

            loss = logs.get("loss", logs.get("train_loss"))
            lr = logs.get("learning_rate")
            if loss is not None:
                history["loss"].append(round(float(loss), 6))
            if lr is not None:
                history["lr"].append(float(lr))
            history["step"].append(int(state.global_step))
            history["epoch"].append(round(float(state.epoch or 0.0), 4))

            progress = int(min(99, (state.global_step / max(1, total_steps)) * 100))
            emit(
                "training-progress",
                {
                    "progress": progress,
                    "step": int(state.global_step),
                    "total_steps": int(total_steps),
                    "loss": float(loss) if loss is not None else None,
                    "learning_rate": float(lr) if lr is not None else None,
                    "lr": float(lr) if lr is not None else None,
                    "epoch": round(float(state.epoch or 0.0), 4),
                    "elapsed_time": int(time.time() - started),
                    "message": f"Step {state.global_step}/{total_steps}",
                },
            )

        def on_step_end(self, args, state, control, **kwargs):
            if stop_requested():
                control.should_training_stop = True
            return control

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=collator,
        callbacks=[_ProgressCallback()],
    )

    emit("training-status", {"message": "Starting LoRA training...", "phase": "training_start", "total_steps": total_steps})
    trainer.train()

    if stop_requested():
        raise _StopByUser("Training stopped by user")

    trainer.save_model(str(out))
    tokenizer.save_pretrained(str(out))

    training_config = dict(config)
    training_config["mode"] = "lora"
    training_config["device"] = device
    training_config["lora_target_modules"] = target_modules

    (out / "training_config.json").write_text(json.dumps(training_config, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "training_history.json").write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "metadata.json").write_text(
        json.dumps(
            {
                "name": config.get("name", out.name),
                "train_mode": "lora",
                "base_model": base_model,
                "created_at": int(time.time()),
                "dataset_path": dataset_path,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return {
        "history": history,
        "output_dir": str(out),
        "final_loss": history["loss"][-1] if history["loss"] else None,
        "total_steps": int(history["step"][-1] if history["step"] else 0),
    }
