import csv
import io
import json
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

INPUT_ALIASES = [
    "input",
    "question",
    "prompt",
    "instruction",
    "user",
    "human",
    "query",
    "request",
    "ask",
    "problem",
    "task",
    "context",
    "source",
    "src",
    "sentence1",
    "text_a",
    "вопрос",
    "запрос",
    "промпт",
    "инструкция",
    "пользователь",
    "человек",
    "контекст",
    "источник",
    "src_ru",
]

OUTPUT_ALIASES = [
    "output",
    "answer",
    "response",
    "reply",
    "assistant",
    "bot",
    "completion",
    "result",
    "target",
    "tgt",
    "label",
    "solution",
    "chosen",
    "sentence2",
    "text_b",
    "ответ",
    "реакция",
    "реплика",
    "ассистент",
    "бот",
    "результат",
    "цель",
    "tgt_ru",
]

CONVERSATION_KEYS = [
    "messages",
    "conversation",
    "conversations",
    "dialog",
    "dialogue",
    "chat",
    "turns",
]

ROLE_INPUT = {
    "user",
    "human",
    "client",
    "customer",
    "questioner",
    "prompt",
    "input",
    "instruction",
}

ROLE_OUTPUT = {
    "assistant",
    "bot",
    "model",
    "gpt",
    "ai",
    "system_assistant",
    "response",
    "output",
    "answer",
}

CONTENT_KEYS = [
    "content",
    "text",
    "value",
    "message",
    "utterance",
    "output",
    "response",
    "answer",
]

MOJIBAKE_MARKERS = ("Ð", "Ñ", "Ã", "Â", "â")
ENCODING_CANDIDATES = (
    "utf-8-sig",
    "utf-8",
    "cp1251",
    "cp866",
    "utf-16",
    "utf-16-le",
    "utf-16-be",
    "latin-1",
)


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9а-яё]+", "", str(text).strip().lower())


ROLE_INPUT_NORM = {_norm(x) for x in ROLE_INPUT}
ROLE_OUTPUT_NORM = {_norm(x) for x in ROLE_OUTPUT}


def _to_text(value) -> str:
    if isinstance(value, str):
        return _repair_mojibake(value.strip())
    if isinstance(value, (int, float)):
        return str(value).strip()
    return ""


def _cyrillic_count(text: str) -> int:
    return sum(1 for c in text if ("а" <= c.lower() <= "я") or c in "ёЁ")


def _looks_like_mojibake(text: str) -> bool:
    if len(text) < 4:
        return False
    marker_hits = sum(text.count(ch) for ch in MOJIBAKE_MARKERS)
    return marker_hits >= 2 and (marker_hits / max(1, len(text))) >= 0.03


def _repair_mojibake(text: str) -> str:
    if not _looks_like_mojibake(text):
        return text

    candidates = [text]
    for src_enc in ("latin-1", "cp1252"):
        try:
            repaired = text.encode(src_enc, errors="strict").decode("utf-8", errors="strict")
            candidates.append(repaired)
        except Exception:
            continue

    def score(s: str) -> int:
        return (_cyrillic_count(s) * 3) - (sum(s.count(ch) for ch in MOJIBAKE_MARKERS) * 2) - (s.count("\ufffd") * 5)

    best = max(candidates, key=score)
    return best


def _decode_bytes_auto(raw: bytes) -> str:
    # Always trust UTF-8 first. Many internet datasets are UTF-8; switching to
    # cp1251 while UTF-8 is valid creates mojibake like "РџС..." from good text.
    for enc in ("utf-8-sig", "utf-8"):
        try:
            text = raw.decode(enc, errors="strict")
            if text.startswith("\ufeff"):
                text = text.lstrip("\ufeff")
            return text
        except Exception:
            pass

    for enc in ENCODING_CANDIDATES:
        if enc in ("utf-8-sig", "utf-8"):
            continue
        try:
            text = raw.decode(enc, errors="strict")
            if text.startswith("\ufeff"):
                text = text.lstrip("\ufeff")
            return text
        except Exception:
            continue

    return raw.decode("utf-8", errors="replace")


def _read_text_auto(path: Path) -> str:
    return _decode_bytes_auto(path.read_bytes())


def _score_header(header: str, alias: str) -> int:
    h = _norm(header)
    a = _norm(alias)
    if not h or not a:
        return 0
    if h == a:
        return 100
    if h.startswith(a) or h.endswith(a):
        return 60
    if a in h:
        return 40
    return 0


def _best_column(headers: List[str], aliases: Iterable[str], exclude: Optional[set] = None) -> Optional[str]:
    exclude = exclude or set()
    best_name = None
    best_score = 0
    for h in headers:
        if h in exclude:
            continue
        score = 0
        for alias in aliases:
            score = max(score, _score_header(h, alias))
        if score > best_score:
            best_score = score
            best_name = h
    return best_name if best_score > 0 else None


def _detect_columns(headers: List[str]) -> Tuple[str, str]:
    if len(headers) < 2:
        raise ValueError(f"CSV must have at least 2 columns, got: {headers}")

    src = _best_column(headers, INPUT_ALIASES)
    tgt = _best_column(headers, OUTPUT_ALIASES, exclude={src} if src else set())

    if src is None and tgt is None:
        return headers[0], headers[1]
    if src is None:
        for h in headers:
            if h != tgt:
                return h, tgt
        return headers[0], headers[1]
    if tgt is None:
        for h in headers:
            if h != src:
                return src, h
        return headers[0], headers[1]
    return src, tgt


def _guess_dialect(sample: str):
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except Exception:
        return csv.excel


def _has_header(sample: str) -> bool:
    try:
        return bool(csv.Sniffer().has_header(sample))
    except Exception:
        return True


def _is_header_like(row: List[str]) -> bool:
    if not row:
        return False
    non_empty = [str(x).strip() for x in row if str(x).strip()]
    if len(non_empty) < 2:
        return False
    # Treat as header only when at least one known alias is detected.
    return any(any(_score_header(h, a) > 0 for a in INPUT_ALIASES + OUTPUT_ALIASES) for h in non_empty)


def _load_csv_records(path: Path):
    rows = []
    text = _read_text_auto(path)
    sample = text[:16384]
    if not sample.strip():
        return []

    dialect = _guess_dialect(sample)
    first_row = []
    try:
        first_row = next(csv.reader(io.StringIO(sample), dialect=dialect), [])
    except Exception:
        first_row = []
    header_like = _is_header_like([str(x).strip() for x in first_row])
    has_header = _has_header(sample) or header_like

    if has_header:
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        headers = list(reader.fieldnames or [])
        if headers and _is_header_like(headers):
            src_col, tgt_col = _detect_columns(headers)
            for row in reader:
                src = _to_text(row.get(src_col))
                tgt = _to_text(row.get(tgt_col))
                if src and tgt:
                    rows.append({"input": src, "output": tgt})
            if rows:
                return rows

    # Fallback: headerless or unreadable header.
    reader2 = csv.reader(io.StringIO(text), dialect=dialect)
    first = True
    for row in reader2:
        if not row:
            continue
        if first and (has_header or header_like):
            strong_header = False
            for cell in row:
                if any(_score_header(str(cell), a) >= 60 for a in INPUT_ALIASES + OUTPUT_ALIASES):
                    strong_header = True
                    break
            if strong_header:
                first = False
                continue
        first = False
        if len(row) < 2:
            continue
        src = _to_text(row[0])
        tgt = _to_text(row[1])
        if src and tgt:
            rows.append({"input": src, "output": tgt})
    return rows


def _coerce_record(obj):
    if isinstance(obj, dict):
        return obj
    text = _to_text(obj)
    if text:
        return {"text": text}
    return None


def load_records(dataset_path: str):
    path = Path(dataset_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")

    suffix = path.suffix.lower()
    if suffix == ".csv":
        return _load_csv_records(path)

    text = _read_text_auto(path)
    if suffix == ".jsonl":
        rows = []
        for i, line in enumerate(text.splitlines(), start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception as e:
                raise ValueError(f"Invalid JSONL at line {i}: {e}") from e
            rec = _coerce_record(obj)
            if rec is not None:
                rows.append(rec)
        return rows

    try:
        data = json.loads(text)
    except Exception as e:
        raise ValueError(f"Invalid JSON: {e}") from e

    if isinstance(data, list):
        out = []
        for obj in data:
            rec = _coerce_record(obj)
            if rec is not None:
                out.append(rec)
        return out

    if isinstance(data, dict):
        for key in ("data", "records", "items", "dataset", "examples", "rows", "train"):
            maybe = data.get(key)
            if isinstance(maybe, list):
                out = []
                for obj in maybe:
                    rec = _coerce_record(obj)
                    if rec is not None:
                        out.append(rec)
                return out

        # Sometimes JSON is mapping id -> record.
        if data and all(isinstance(v, dict) for v in data.values()):
            return list(data.values())
        return [data]

    raise ValueError("Unsupported dataset format. Expected JSON, JSONL, or CSV")


def _pick_by_alias_with_key(ex: Dict, aliases: Iterable[str], exclude_keys: Optional[set] = None):
    exclude_keys = exclude_keys or set()
    best_key = None
    best_val = ""
    best_score = 0
    for k, v in ex.items():
        if k in exclude_keys:
            continue
        txt = _to_text(v)
        if not txt:
            continue
        score = 0
        for alias in aliases:
            score = max(score, _score_header(str(k), alias))
        if score > best_score:
            best_score = score
            best_key = k
            best_val = txt
    if best_key is None:
        return None, ""
    return best_key, best_val


def _try_load_json_string(value):
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s or not ((s.startswith("[") and s.endswith("]")) or (s.startswith("{") and s.endswith("}"))):
        return None
    try:
        return json.loads(s)
    except Exception:
        return None


def _message_parts(msg) -> Tuple[str, str]:
    if isinstance(msg, dict):
        role = _to_text(msg.get("role") or msg.get("from") or msg.get("speaker") or msg.get("author") or msg.get("type"))
        content = ""
        for ck in CONTENT_KEYS:
            if ck in msg:
                content = _to_text(msg.get(ck))
                if content:
                    break
        if not content:
            # Fallback: first textual field.
            for v in msg.values():
                content = _to_text(v)
                if content:
                    break
        return role, content
    if isinstance(msg, (list, tuple)) and len(msg) >= 2:
        role = _to_text(msg[0])
        content = _to_text(msg[1])
        return role, content
    return "", _to_text(msg)


def _extract_messages_value(ex: Dict):
    for key in ex.keys():
        k_norm = _norm(key)
        if any(_norm(alias) in k_norm for alias in CONVERSATION_KEYS):
            val = ex.get(key)
            if isinstance(val, list):
                return val
            maybe = _try_load_json_string(val)
            if isinstance(maybe, list):
                return maybe
    return None


def _extract_pairs_from_messages(messages) -> List[Tuple[str, str]]:
    pairs = []
    pending_user = ""
    for msg in messages:
        role, content = _message_parts(msg)
        if not content:
            continue
        r = _norm(role)
        if r in ROLE_INPUT_NORM:
            pending_user = content
            continue
        if r in ROLE_OUTPUT_NORM:
            if pending_user:
                pairs.append((pending_user, content))
                pending_user = ""
            continue

        # Unknown role: try alternating fallback.
        if not pending_user:
            pending_user = content
        else:
            pairs.append((pending_user, content))
            pending_user = ""
    return pairs


def format_record_for_lora(ex: dict) -> str:
    msg_list = _extract_messages_value(ex)
    if isinstance(msg_list, list):
        parts = []
        for q, a in _extract_pairs_from_messages(msg_list):
            parts.append(f"User: {q}\nAssistant: {a}")
        if parts:
            return "\n\n".join(parts)

    if "instruction" in ex and "response" in ex:
        inst = _to_text(ex.get("instruction"))
        inp = _to_text(ex.get("input"))
        resp = _to_text(ex.get("response"))
        if inp:
            return f"### Instruction:\n{inst}\n\n### Input:\n{inp}\n\n### Response:\n{resp}"
        return f"### Instruction:\n{inst}\n\n### Response:\n{resp}"
    if "prompt" in ex and "completion" in ex:
        return f"{_to_text(ex.get('prompt'))}\n{_to_text(ex.get('completion'))}".strip()
    if "input" in ex and "output" in ex:
        return f"Input: {_to_text(ex.get('input'))}\nOutput: {_to_text(ex.get('output'))}".strip()
    if "question" in ex and "answer" in ex:
        return f"Question: {_to_text(ex.get('question'))}\nAnswer: {_to_text(ex.get('answer'))}".strip()
    if "text" in ex:
        return _to_text(ex.get("text"))
    if "content" in ex:
        return _to_text(ex.get("content"))

    _, src = _pick_by_alias_with_key(ex, INPUT_ALIASES)
    _, tgt = _pick_by_alias_with_key(ex, OUTPUT_ALIASES)
    if src and tgt:
        return f"Input: {src}\nOutput: {tgt}"

    parts = [str(v).strip() for v in ex.values() if isinstance(v, (str, int, float)) and str(v).strip()]
    return "\n".join(parts)


def extract_lora_texts(records):
    texts = []
    for ex in records:
        t = format_record_for_lora(ex)
        if t and t.strip():
            texts.append(t.strip())
    return texts


def extract_pairs(records):
    pairs = []
    for ex in records:
        if not isinstance(ex, dict):
            continue

        msg_list = _extract_messages_value(ex)
        if isinstance(msg_list, list):
            msg_pairs = _extract_pairs_from_messages(msg_list)
            if msg_pairs:
                pairs.extend([(s.strip(), t.strip()) for s, t in msg_pairs if s and t])
                continue

        src = ""
        tgt = ""
        src_key = None

        if "instruction" in ex and "response" in ex:
            inst = _to_text(ex.get("instruction"))
            inp = _to_text(ex.get("input"))
            src = f"{inst}\n{inp}".strip() if inp else inst
            tgt = _to_text(ex.get("response"))
        elif "prompt" in ex and "completion" in ex:
            src = _to_text(ex.get("prompt"))
            tgt = _to_text(ex.get("completion"))
        elif "input" in ex and "output" in ex:
            src = _to_text(ex.get("input"))
            tgt = _to_text(ex.get("output"))
        elif "question" in ex and "answer" in ex:
            src = _to_text(ex.get("question"))
            tgt = _to_text(ex.get("answer"))
        else:
            src_key, src = _pick_by_alias_with_key(ex, INPUT_ALIASES)
            _, tgt = _pick_by_alias_with_key(ex, OUTPUT_ALIASES, exclude_keys={src_key} if src_key else set())

        if src and tgt:
            pairs.append((str(src).strip(), str(tgt).strip()))

    return pairs


def explain_pair_extraction_issue(records, sample_size: int = 5) -> str:
    if not records:
        return "Dataset is empty."

    key_counts: Dict[str, int] = {}
    for ex in records[: max(50, sample_size)]:
        if isinstance(ex, dict):
            for k in ex.keys():
                key_counts[str(k)] = key_counts.get(str(k), 0) + 1

    top_keys = sorted(key_counts.items(), key=lambda x: x[1], reverse=True)[:12]
    keys_str = ", ".join([k for k, _ in top_keys]) if top_keys else "no object keys detected"

    hints = [
        "Expected pair-like fields such as: instruction/response, input/output, prompt/completion, question/answer.",
        "For chat datasets, supported fields include messages/conversations lists with user/assistant roles.",
        f"Detected top keys: {keys_str}.",
    ]
    return " ".join(hints)


def count_records_fast(path: str) -> int:
    p = Path(path)
    if not p.exists():
        return 0
    if p.suffix.lower() == ".csv":
        lines = [ln for ln in _read_text_auto(p).splitlines() if ln.strip()]
        if not lines:
            return 0
        sample = "\n".join(lines[:50])
        dialect = _guess_dialect(sample)
        try:
            first_row = next(csv.reader([lines[0]], dialect=dialect), [])
        except Exception:
            first_row = []
        has_header = _has_header(sample) and _is_header_like([x.strip() for x in first_row])
        return max(0, len(lines) - (1 if has_header else 0))
    if p.suffix.lower() == ".jsonl":
        return sum(1 for line in _read_text_auto(p).splitlines() if line.strip())
    try:
        data = json.loads(_read_text_auto(p))
        if isinstance(data, list):
            return len(data)
        if isinstance(data, dict):
            for key in ("data", "records", "items", "dataset", "examples", "rows", "train"):
                if isinstance(data.get(key), list):
                    return len(data[key])
            return 1
        return 0
    except Exception:
        return 0
