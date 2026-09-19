# Bundled inference engine (llama-server)

ZeqouXChat runs downloaded GGUF models with **zero extra installs**.

## Normal path: automatic download (no action needed)

On first use the app itself picks the right build from
https://github.com/ggml-org/llama.cpp/releases (latest tag via the GitHub API,
CUDA build for NVIDIA / CPU otherwise), downloads the zip with progress,
unpacks the single `llama-server` binary into the app-data `binaries/` folder
and starts it via the `engine_start` Tauri command. Nothing is committed to git.

## Manual path (dev / offline builds)

Place the **single `llama-server` binary** in this folder, renamed per target:

Download from https://github.com/ggml-org/llama.cpp/releases
(`llama-<version>-bin-win-cuda-*.zip` for NVIDIA Windows,
`-bin-win-cpu-*` for CPU-only, macOS / Linux equivalents) and unpack the
**single `llama-server` binary** here, renamed per target triple:

| OS / arch            | filename                                    |
|----------------------|---------------------------------------------|
| Windows x86_64       | `llama-server-x86_64-pc-windows-msvc.exe`   |
| macOS Apple Silicon  | `llama-server-aarch64-apple-darwin`         |
| macOS Intel          | `llama-server-x86_64-apple-darwin`          |
| Linux x86_64         | `llama-server-x86_64-unknown-linux-gnu`     |

Tauri appends the triple automatically (`externalBin: ["binaries/llama-server"]`
in `tauri.conf.json`), so the app finds the right file on every platform.

Binaries are git-ignored (too large for the repo) — each release build machine
fetches its own. Without a binary the app still works fully via
Ollama / LM Studio / API providers; the built-in engine simply reports
"missing" with a link to this page.
