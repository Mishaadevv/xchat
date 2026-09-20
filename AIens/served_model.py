"""OpenAI-compatible HTTP server for models trained by AIens.

Why this exists: the chat screen talks an OpenAI dialect (sendMessageStream),
so a trained model must speak it too. This server loads a trained scratch
model through trained_inference and serves:

  POST /v1/chat/completions   (stream: SSE deltas; non-stream: single JSON)
  POST /v1/completions        (legacy prompt shape)
  GET  /health                (liveness for the UI: 200 {"ok": true})

Only 127.0.0.1 is bound — the model is served to the local app, not the LAN.
Generation runs through ScratchChatbot (top-p/top-k, repetition penalty,
temperature), honouring the device recorded in training_config.json.
"""
import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from trained_inference import TrainedModelRuntime

RUNTIME = TrainedModelRuntime()
MODEL_NAME = "trained-scratch"


def chat_to_prompt(messages):
    """Flatten an OpenAI-style message list into one prompt string."""
    parts = []
    for msg in messages or []:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "user")).lower()
        content = str(msg.get("content", "") or "")
        if role == "system":
            parts.append(f"System: {content}")
        elif role == "assistant":
            parts.append(f"Assistant: {content}")
        else:
            parts.append(f"User: {content}")
    parts.append("Assistant:")
    return "\n".join(parts)


def extract_params(body):
    body = body or {}
    max_tokens = body.get("max_tokens") or body.get("max_completion_tokens") or 256
    try:
        max_tokens = max(1, min(1024, int(max_tokens)))
    except (TypeError, ValueError):
        max_tokens = 256
    temperature = body.get("temperature")
    try:
        temperature = float(temperature) if temperature is not None else 0.7
    except (TypeError, ValueError):
        temperature = 0.7
    return max_tokens, temperature


class Handler(BaseHTTPRequestHandler):
    server_version = "ZeqouTrainedServing/1.0"

    def log_message(self, fmt, *args):  # silence default stderr spam
        pass

    def _json(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path in ("/health", "/v1/health", "/"):
            self._json(200, {"ok": True, "model": MODEL_NAME, "mode": RUNTIME.mode})
        elif self.path == "/v1/models":
            self._json(200, {"object": "list", "data": [{"id": MODEL_NAME, "object": "model"}]})
        else:
            self._json(404, {"error": {"message": f"not found: {self.path}"}})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception as exc:
            self._json(400, {"error": {"message": f"bad json: {exc}"}})
            return

        if self.path not in ("/v1/chat/completions", "/v1/completions", "/chat/completions", "/completions"):
            self._json(404, {"error": {"message": f"not found: {self.path}"}})
            return

        if RUNTIME.mode is None:
            self._json(503, {"error": {"message": "model is not loaded yet"}})
            return

        messages = body.get("messages") or []
        prompt = chat_to_prompt(messages) if messages else str(body.get("prompt", ""))
        max_tokens, temperature = extract_params(body)

        created = int(time.time())
        comp_id = f"chatcmpl-trained-{created}"

        if body.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            def send_chunk(delta_content, finish_reason=None):
                chunk = {
                    "id": comp_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": MODEL_NAME,
                    "choices": [{"index": 0, "delta": {}, "finish_reason": finish_reason}],
                }
                if delta_content is not None:
                    chunk["choices"][0]["delta"] = {"content": delta_content}
                self.wfile.write(f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()

            try:
                text = RUNTIME.generate(prompt, max_tokens=max_tokens, temperature=temperature)
            except Exception as exc:
                text = f"[serving error: {exc}]"
            # Chunk in small pieces so the UI shows real streaming.
            step = 8
            for i in range(0, len(text), step):
                send_chunk(text[i : i + step])
            send_chunk("", finish_reason="stop")
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
            return

        try:
            text = RUNTIME.generate(prompt, max_tokens=max_tokens, temperature=temperature)
        except Exception as exc:
            self._json(500, {"error": {"message": f"generation failed: {exc}"}})
            return
        self._json(200, {
            "id": comp_id,
            "object": "chat.completion",
            "created": created,
            "model": MODEL_NAME,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        })


def main():
    parser = argparse.ArgumentParser(description="Serve a trained AIens model")
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--port", type=int, default=48219)
    args = parser.parse_args()

    RUNTIME.load_model(args.model_dir)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"serving {args.model_dir} on 127.0.0.1:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
