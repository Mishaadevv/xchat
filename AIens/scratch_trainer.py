import json
import math
import random
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

from training_data import explain_pair_extraction_issue, extract_pairs, load_records

SEED = 42
random.seed(SEED)
torch.manual_seed(SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)

PAD, BOS, EOS, UNK = "<PAD>", "<BOS>", "<EOS>", "<UNK>"


class Tokenizer:
    def __init__(self):
        self.token2id: Dict[str, int] = {}
        self.id2token: Dict[int, str] = {}
        for tok in [PAD, BOS, EOS, UNK]:
            self._add(tok)

    def _add(self, tok: str) -> int:
        if tok not in self.token2id:
            idx = len(self.token2id)
            self.token2id[tok] = idx
            self.id2token[idx] = tok
        return self.token2id[tok]

    @staticmethod
    def _split(text: str) -> List[str]:
        return re.findall(r"\w+|[^\w\s]", text.lower())

    def build(self, texts: List[str], min_freq: int = 1):
        freq: Dict[str, int] = {}
        for t in texts:
            for tok in self._split(t):
                freq[tok] = freq.get(tok, 0) + 1
        for tok, cnt in freq.items():
            if cnt >= min_freq:
                self._add(tok)

    def encode(self, text: str) -> List[int]:
        unk = self.token2id[UNK]
        return [self.token2id.get(t, unk) for t in self._split(text)]

    def decode(self, ids: List[int]) -> str:
        tokens = []
        for i in ids:
            tok = self.id2token.get(i, UNK)
            if tok in (PAD, BOS, EOS):
                continue
            tokens.append(tok)
        out = ""
        for tok in tokens:
            if out and not re.match(r"^[^\w]", tok):
                out += " "
            out += tok
        return out.strip()

    @property
    def vocab_size(self) -> int:
        return len(self.token2id)

    def save(self, path: Path):
        path.write_text(json.dumps(self.token2id, ensure_ascii=False, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "Tokenizer":
        obj = cls()
        obj.token2id = json.loads(path.read_text(encoding="utf-8"))
        obj.id2token = {v: k for k, v in obj.token2id.items()}
        return obj


class ChatDataset(Dataset):
    def __init__(self, pairs: List[Tuple[str, str]], tokenizer: Tokenizer, max_len: int = 64):
        self.pairs = pairs
        self.tok = tokenizer
        self.max_len = max_len
        self.bos = tokenizer.token2id[BOS]
        self.eos = tokenizer.token2id[EOS]

    def _encode(self, text: str) -> List[int]:
        return self.tok.encode(text)[: self.max_len]

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        src_text, tgt_text = self.pairs[idx]
        src = self._encode(src_text)
        tgt = self._encode(tgt_text)
        tgt_in = [self.bos] + tgt
        tgt_out = tgt + [self.eos]
        return (
            torch.tensor(src, dtype=torch.long),
            torch.tensor(tgt_in, dtype=torch.long),
            torch.tensor(tgt_out, dtype=torch.long),
        )


def collate_fn(batch, pad_id: int):
    srcs, tgt_ins, tgt_outs = zip(*batch)

    def pad(seqs):
        ml = max(s.size(0) for s in seqs)
        return torch.stack([F.pad(s, (0, ml - s.size(0)), value=pad_id) for s in seqs])

    return pad(srcs), pad(tgt_ins), pad(tgt_outs)


class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 512, dropout: float = 0.0):
        super().__init__()
        self.drop = nn.Dropout(dropout)
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(max_len).unsqueeze(1)
        div = torch.exp(torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        x = x + self.pe[:, : x.size(1)]
        return self.drop(x)


class Seq2SeqTransformer(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        d_model: int = 256,
        nhead: int = 4,
        num_encoder_layers: int = 3,
        num_decoder_layers: int = 3,
        dim_ff: int = 512,
        dropout: float = 0.1,
        max_len: int = 128,
    ):
        super().__init__()
        self.d_model = d_model
        self.src_emb = nn.Embedding(vocab_size, d_model, padding_idx=0)
        self.tgt_emb = nn.Embedding(vocab_size, d_model, padding_idx=0)
        self.pos_enc = PositionalEncoding(d_model, max_len, dropout)
        self.transformer = nn.Transformer(
            d_model=d_model,
            nhead=nhead,
            num_encoder_layers=num_encoder_layers,
            num_decoder_layers=num_decoder_layers,
            dim_feedforward=dim_ff,
            dropout=dropout,
            batch_first=True,
        )
        self.fc_out = nn.Linear(d_model, vocab_size)
        self._init_weights()

    def _init_weights(self):
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def _pad_mask(self, x: torch.Tensor):
        return x == 0

    def forward(self, src: torch.Tensor, tgt: torch.Tensor, tgt_mask: Optional[torch.Tensor] = None):
        src_pad = self._pad_mask(src)
        tgt_pad = self._pad_mask(tgt)
        if tgt_mask is None:
            tgt_len = tgt.size(1)
            tgt_mask = nn.Transformer.generate_square_subsequent_mask(tgt_len, device=src.device)

        src_emb = self.pos_enc(self.src_emb(src) * math.sqrt(self.d_model))
        tgt_emb = self.pos_enc(self.tgt_emb(tgt) * math.sqrt(self.d_model))

        out = self.transformer(
            src_emb,
            tgt_emb,
            tgt_mask=tgt_mask,
            src_key_padding_mask=src_pad,
            tgt_key_padding_mask=tgt_pad,
            memory_key_padding_mask=src_pad,
        )
        return self.fc_out(out)

    @torch.no_grad()
    def generate(
        self,
        src: torch.Tensor,
        bos_id: int,
        eos_id: int,
        max_new: int = 64,
        temperature: float = 0.8,
        top_k: int = 50,
        top_p: float = 0.9,
        repetition_penalty: float = 1.1,
    ) -> List[int]:
        device = src.device
        generated = [bos_id]

        for _ in range(max_new):
            tgt = torch.tensor([generated], dtype=torch.long, device=device)
            logits = self(src, tgt)[:, -1, :]

            if repetition_penalty > 1.0:
                for token_id in set(generated):
                    logits[:, token_id] /= repetition_penalty

            if temperature <= 0:
                next_id = int(torch.argmax(logits, dim=-1).item())
            else:
                logits = logits / temperature

                if top_k > 0:
                    vals, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                    min_val = vals[:, -1].unsqueeze(-1)
                    logits = torch.where(logits < min_val, torch.full_like(logits, -float("inf")), logits)

                if 0 < top_p < 1:
                    sorted_logits, sorted_idx = torch.sort(logits, descending=True)
                    probs = torch.softmax(sorted_logits, dim=-1)
                    cumulative = torch.cumsum(probs, dim=-1)
                    sorted_mask = cumulative > top_p
                    sorted_mask[:, 1:] = sorted_mask[:, :-1].clone()
                    sorted_mask[:, 0] = False
                    mask = torch.zeros_like(logits, dtype=torch.bool)
                    mask.scatter_(1, sorted_idx, sorted_mask)
                    logits = logits.masked_fill(mask, -float("inf"))

                probs = torch.softmax(logits, dim=-1)
                next_id = int(torch.multinomial(probs, 1).item())

            if next_id == eos_id:
                break
            generated.append(next_id)

        return generated[1:]


@dataclass
class TrainResult:
    history: dict
    output_dir: str
    final_loss: Optional[float]
    total_steps: int
    stopped: bool = False
    last_checkpoint: str = ""


class ScratchChatbot:
    def __init__(self, model, tokenizer: Tokenizer, cfg: dict, device: str):
        self.model = model
        self.tok = tokenizer
        self.cfg = cfg
        self.device = device
        self.bos = self.tok.token2id[BOS]
        self.eos = self.tok.token2id[EOS]
        self.max_len = int(cfg.get("max_length", 64))

    @classmethod
    def from_dir(cls, model_dir: str):
        model_path = Path(model_dir)
        metadata = json.loads((model_path / "metadata.json").read_text(encoding="utf-8"))
        checkpoint_name = metadata.get("checkpoint", "scratch_best.pt")
        ckpt = torch.load(model_path / checkpoint_name, map_location="cpu")
        cfg = ckpt.get("config", {})

        tok = Tokenizer.load(model_path / "tokenizer.json")
        model = Seq2SeqTransformer(
            vocab_size=tok.vocab_size,
            d_model=int(cfg.get("d_model", 256)),
            nhead=int(cfg.get("nhead", 4)),
            num_encoder_layers=int(cfg.get("num_enc_layers", 3)),
            num_decoder_layers=int(cfg.get("num_dec_layers", 3)),
            dim_ff=int(cfg.get("dim_ff", 512)),
            dropout=0.0,
            max_len=int(cfg.get("max_length", 64)) * 2 + 10,
        )
        model.load_state_dict(ckpt["model"])
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        model.eval()
        return cls(model, tok, cfg, device)

    @torch.no_grad()
    def generate(self, prompt: str, max_tokens: int = 64, temperature: float = 0.8):
        ids = self.tok.encode(prompt)[: self.max_len]
        if not ids:
            return ""
        src = torch.tensor([ids], dtype=torch.long, device=self.device)
        out_ids = self.model.generate(
            src,
            self.bos,
            self.eos,
            max_new=max_tokens,
            temperature=max(temperature, 1e-4),
            top_k=50,
            top_p=0.9,
            repetition_penalty=1.1,
        )
        return self.tok.decode(out_ids)


def _emit_progress(
    emit,
    global_step,
    total_steps,
    loss,
    epoch,
    lr,
    started,
    epoch_step,
    epoch_total_steps,
):
    progress = int(min(99, (global_step / max(1, total_steps)) * 100))
    emit(
        "training-progress",
        {
            "progress": progress,
            "step": global_step,
            "total_steps": total_steps,
            "global_step": global_step,
            "epoch_step": epoch_step,
            "epoch_total_steps": epoch_total_steps,
            "loss": float(loss) if loss is not None else None,
            "learning_rate": float(lr),
            "lr": float(lr),
            "epoch": float(epoch),
            "elapsed_time": int(time.time() - started),
            "message": f"Epoch {int(epoch)}: step {epoch_step}/{epoch_total_steps}",
        },
    )


def train_scratch(config: dict, output_dir: str, emit, stop_requested) -> TrainResult:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    dataset_path = config.get("dataset_path")
    if not dataset_path:
        raise ValueError("dataset_path is required")

    emit("training-status", {"message": "Loading dataset...", "phase": "dataset"})
    records = load_records(dataset_path)
    pairs = extract_pairs(records)
    if not pairs:
        reason = explain_pair_extraction_issue(records)
        raise ValueError(f"No training pairs could be extracted. {reason}")

    max_length = int(config.get("max_length", 64))
    batch_size = int(config.get("batch_size", 16))
    epochs = int(config.get("epochs", 5))
    learning_rate = float(config.get("learning_rate", 3e-4))
    accumulation_steps = max(1, int(config.get("accumulation_steps", 1)))
    checkpoint_every_epochs = max(1, int(config.get("checkpoint_every_epochs", 1)))
    progress_every_steps = max(1, int(config.get("progress_every_steps", 1)))

    emit("training-status", {"message": f"Dataset loaded: {len(pairs)} pairs", "phase": "dataset_loaded"})

    tok = Tokenizer()
    tok.build([x for p in pairs for x in p], min_freq=int(config.get("min_freq", 1)))
    tok.save(out / "tokenizer.json")

    ds = ChatDataset(pairs, tok, max_len=max_length)
    loader = DataLoader(
        ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        drop_last=False,
        collate_fn=lambda b: collate_fn(b, tok.token2id[PAD]),
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = Seq2SeqTransformer(
        vocab_size=tok.vocab_size,
        d_model=int(config.get("d_model", 256)),
        nhead=int(config.get("nhead", 4)),
        num_encoder_layers=int(config.get("num_enc_layers", 3)),
        num_decoder_layers=int(config.get("num_dec_layers", 3)),
        dim_ff=int(config.get("dim_ff", 512)),
        dropout=float(config.get("dropout", 0.1)),
        max_len=max_length * 2 + 10,
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=float(config.get("weight_decay", 0.01)))
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, epochs))
    criterion = nn.CrossEntropyLoss(ignore_index=tok.token2id[PAD])

    history = {"loss": [], "lr": [], "epoch": [], "step": []}
    best_loss = float("inf")
    best_name = "scratch_best.pt"
    best_saved = False
    last_checkpoint = ""
    stopped_by_user = False

    total_steps = max(1, len(loader) * epochs)
    step = 0
    started = time.time()

    emit("training-status", {"message": f"Start scratch training on {device.upper()}", "phase": "training_start", "total_steps": total_steps})

    optimizer.zero_grad()
    for epoch in range(1, epochs + 1):
        stop_before_epoch = stop_requested()
        if stop_before_epoch:
            stopped_by_user = True
            emit(
                "training-status",
                {
                    "message": "Stop requested. Saving last checkpoint...",
                    "phase": "stopping",
                    "epoch": epoch,
                },
            )

        model.train()
        running = 0.0
        epoch_steps = max(1, len(loader))
        processed_batches = 0
        if not stop_before_epoch:
            for batch_idx, (src, tgt_in, tgt_out) in enumerate(loader, 1):
                if stop_requested():
                    stopped_by_user = True
                    emit(
                        "training-status",
                        {
                            "message": "Stop requested. Finishing current save...",
                            "phase": "stopping",
                            "epoch": epoch,
                        },
                    )
                    break

                src = src.to(device, non_blocking=True)
                tgt_in = tgt_in.to(device, non_blocking=True)
                tgt_out = tgt_out.to(device, non_blocking=True)

                logits = model(src, tgt_in)
                bsz, tsz, vsz = logits.shape
                loss = criterion(logits.view(bsz * tsz, vsz), tgt_out.view(bsz * tsz))
                (loss / accumulation_steps).backward()
                running += float(loss.item())

                if (batch_idx % accumulation_steps) == 0 or batch_idx == len(loader):
                    nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                    optimizer.step()
                    optimizer.zero_grad()

                step += 1
                processed_batches += 1
                lr = float(optimizer.param_groups[0]["lr"])

                if (batch_idx % progress_every_steps) == 0 or batch_idx == len(loader):
                    history["loss"].append(round(float(loss.item()), 6))
                    history["lr"].append(lr)
                    history["epoch"].append(round(epoch + batch_idx / max(1, len(loader)), 4))
                    history["step"].append(step)
                    _emit_progress(
                        emit,
                        global_step=step,
                        total_steps=total_steps,
                        loss=float(loss.item()),
                        epoch=epoch,
                        lr=lr,
                        started=started,
                        epoch_step=batch_idx,
                        epoch_total_steps=epoch_steps,
                    )

                if stopped_by_user:
                    break

        if processed_batches > 0:
            scheduler.step()

        avg_loss = running / max(1, processed_batches if processed_batches > 0 else len(loader))
        emit("training-status", {"message": f"Epoch {epoch}/{epochs} complete, avg_loss={avg_loss:.4f}", "phase": "epoch_complete", "epoch": epoch})

        ckpt = {
            "model": model.state_dict(),
            "config": {
                "max_length": max_length,
                "d_model": int(config.get("d_model", 256)),
                "nhead": int(config.get("nhead", 4)),
                "num_enc_layers": int(config.get("num_enc_layers", 3)),
                "num_dec_layers": int(config.get("num_dec_layers", 3)),
                "dim_ff": int(config.get("dim_ff", 512)),
                "dropout": float(config.get("dropout", 0.1)),
            },
            "epoch": epoch,
            "global_step": step,
        }

        should_save_epoch = stopped_by_user or (epoch % checkpoint_every_epochs == 0) or (epoch == epochs)
        if should_save_epoch:
            last_checkpoint = f"scratch_epoch_{epoch:03d}.pt"
            torch.save(ckpt, out / last_checkpoint)

        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(ckpt, out / best_name)
            best_saved = True

        if stopped_by_user:
            break

    if not best_saved and last_checkpoint:
        best_name = last_checkpoint

    training_config = dict(config)
    training_config["mode"] = "scratch"
    training_config["device"] = device
    training_config["checkpoint_every_epochs"] = checkpoint_every_epochs

    (out / "training_config.json").write_text(json.dumps(training_config, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "training_history.json").write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "metadata.json").write_text(
        json.dumps(
            {
                "name": config.get("name", out.name),
                "train_mode": "scratch",
                "arch": "seq2seq_transformer",
                "checkpoint": best_name,
                "created_at": int(time.time()),
                "dataset_path": dataset_path,
                "status": "stopped" if stopped_by_user else "completed",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return TrainResult(
        history=history,
        output_dir=str(out),
        final_loss=history["loss"][-1] if history["loss"] else None,
        total_steps=step,
        stopped=stopped_by_user,
        last_checkpoint=last_checkpoint or best_name,
    )
