# ZeqouXChat

Desktop AI chat application built around modern AI providers and developer workflows. Fast conversations, code and file support, and a workspace that adapts to you.

Part of the [Zeqou ecosystem](https://mishaadevv.github.io/zeqou/).

## Features

- Modern chat interface with streaming responses
- Code highlighting (highlight.js), Markdown, KaTeX formulas
- Provider choice: OpenAI, Anthropic, Google, OpenRouter, Ollama, custom endpoints
- Built with Tauri 2 + React 19 — small footprint, native feel

## Develop

Requires Node.js and the [Rust toolchain](https://rustup.rs/).

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## AIens (optional)

The `AIens/` folder contains experimental Python tools for dataset preparation and model training. See `requirements-ml.txt` there.

## License

[PolyForm Strict 1.0.0](LICENSE) — viewing and personal use are allowed; copying, modification, redistribution and derivative works are not permitted without the author's permission.
