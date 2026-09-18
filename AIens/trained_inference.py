import json
from pathlib import Path


class TrainedModelRuntime:
    def __init__(self):
        self._mode = None
        self._model = None
        self._tokenizer = None
        self._scratch = None
        self._model_dir = None

    @property
    def mode(self):
        return self._mode

    @property
    def model_dir(self):
        return self._model_dir

    def unload(self):
        self._mode = None
        self._model = None
        self._tokenizer = None
        self._scratch = None
        self._model_dir = None

    def load_model(self, model_dir: str):
        p = Path(model_dir)
        if not p.exists():
            raise FileNotFoundError(f"Model directory not found: {model_dir}")

        metadata_path = p / "metadata.json"
        cfg_path = p / "training_config.json"

        metadata = {}
        cfg = {}
        if metadata_path.exists():
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if cfg_path.exists():
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))

        mode = (metadata.get("train_mode") or cfg.get("mode") or "scratch").lower()

        if mode != "scratch":
            raise ValueError(f"Unsupported trained model mode in current build: {mode}")

        from scratch_trainer import ScratchChatbot

        self._scratch = ScratchChatbot.from_dir(str(p))
        self._mode = "scratch"
        self._model_dir = str(p)
        self._model = None
        self._tokenizer = None
        return {"mode": self._mode, "path": self._model_dir}

    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7):
        prompt = (prompt or "").strip()
        if not prompt:
            return ""

        if self._mode == "scratch":
            return self._scratch.generate(prompt, max_tokens=max_tokens, temperature=temperature)

        if self._mode != "scratch":
            raise RuntimeError("No trained model loaded for inference")
        return self._scratch.generate(prompt, max_tokens=max_tokens, temperature=temperature)
