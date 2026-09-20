import { isTauri as isTauriEnv } from "@/lib/platform";
import { pythonEnv } from "@/services/pythonEnv";

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "code" | "web" | "data" | "system" | "custom";
  enabled: boolean;
}

export interface MCPResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface MCPFileInput {
  path?: string;
  content?: string;
  query?: string;
  url?: string;
  code?: string;
  command?: string;
  projectPath?: string;
  name?: string;
  mode?: string;
  dataset_path?: string;
  base_model?: string;
  epochs?: number;
}

const defaultTools: MCPTool[] = [
  { id: "read-file", name: "Read File", description: "Read contents of a file from the filesystem", icon: "FileText", category: "system", enabled: true },
  { id: "write-file", name: "Write File", description: "Write content to a file on the filesystem", icon: "FileEdit", category: "system", enabled: true },
  { id: "list-dir", name: "List Directory", description: "List files and folders in a directory", icon: "FolderTree", category: "system", enabled: true },
  { id: "web-search", name: "Web Search", description: "Search the internet for information", icon: "Globe", category: "web", enabled: true },
  { id: "fetch-url", name: "Fetch URL", description: "Fetch content from a web URL", icon: "Link", category: "web", enabled: true },
  { id: "run-code", name: "Run Code", description: "Execute JavaScript code in a sandbox (browser-safe, no FS)", icon: "Terminal", category: "code", enabled: false },
  { id: "terminal", name: "Terminal", description: "Run a shell command on the system (Tauri only)", icon: "Shell", category: "system", enabled: false },
  { id: "train-model", name: "Train Model", description: "Start training or fine-tuning an AI model with a dataset", icon: "Brain", category: "custom", enabled: false },
  { id: "list-tools", name: "List MCP Tools", description: "List all available MCP tools and their status", icon: "Wrench", category: "system", enabled: true },
  // ── Extended skills ───────────────────────────────────────────────────
  { id: "delete-file", name: "Delete File", description: "Delete a file or empty directory", icon: "Trash2", category: "system", enabled: true },
  { id: "create-directory", name: "Create Directory", description: "Create a new directory (with parents)", icon: "FolderPlus", category: "system", enabled: true },
  { id: "copy-file", name: "Copy File", description: "Copy a file to a new location", icon: "Copy", category: "system", enabled: true },
  { id: "move-file", name: "Move File", description: "Move/rename a file or directory", icon: "Move", category: "system", enabled: true },
  { id: "file-stat", name: "File Info", description: "Get file stats (size, modified, isDir)", icon: "Info", category: "system", enabled: true },
  { id: "search-files", name: "Search Files", description: "Search for files by name or content (grep)", icon: "Search", category: "system", enabled: true },
  { id: "git-status", name: "Git Status", description: "Show git status for project", icon: "GitBranch", category: "code", enabled: true },
  { id: "git-diff", name: "Git Diff", description: "Show git diff (unstaged changes)", icon: "GitCompare", category: "code", enabled: true },
  { id: "git-log", name: "Git Log", description: "Show recent git commits", icon: "History", category: "code", enabled: true },
  { id: "git-commit", name: "Git Commit", description: "Commit staged changes with a message", icon: "GitCommit", category: "code", enabled: true },
  { id: "system-info", name: "System Info", description: "Get OS, CPU, memory, and app info", icon: "Monitor", category: "system", enabled: true },
  { id: "open-in-explorer", name: "Open in Explorer", description: "Open project folder in file manager", icon: "ExternalLink", category: "system", enabled: true },
  { id: "run-python", name: "Run Python", description: "Execute Python code", icon: "Code", category: "code", enabled: true },
  { id: "format-code", name: "Format Code", description: "Format code with prettier-like rules", icon: "Wand2", category: "code", enabled: true },
  { id: "summarize-file", name: "Summarize File", description: "Summarize a file's content concisely", icon: "FileText", category: "custom", enabled: true },
  // ── Memory (long-term) ────────────────────────────────────────────────
  { id: "add-memory", name: "Add Memory", description: "Save a fact/preference to long-term memory", icon: "Brain", category: "custom", enabled: true },
  { id: "list-memory", name: "List Memory", description: "List all long-term memories", icon: "BookOpen", category: "custom", enabled: true },
  { id: "search-memory", name: "Search Memory", description: "Search memories by keyword", icon: "Search", category: "custom", enabled: true },
  { id: "update-memory", name: "Update Memory", description: "Update an existing memory by id", icon: "Edit", category: "custom", enabled: true },
  { id: "remove-memory", name: "Remove Memory", description: "Delete a memory by id", icon: "Trash2", category: "custom", enabled: true },
  { id: "clear-memory", name: "Clear Memory", description: "Clear all memories (or only unpinned)", icon: "Trash", category: "custom", enabled: false },
];

function loadTools(): MCPTool[] {
  try {
    const raw = localStorage.getItem("zeqouxchat-mcp-tools");
    if (raw) {
      const saved = JSON.parse(raw);
      return defaultTools.map((t) => ({
        ...t,
        enabled: saved.find((s: any) => s.id === t.id)?.enabled ?? t.enabled,
      }));
    }
  } catch {}
  return defaultTools;
}

export function getEnabledTools(): string[] {
  return loadTools().filter((t) => t.enabled).map((t) => t.id);
}
export function getAllMCPTools(): MCPTool[] {
  return loadTools();
}
export function saveMCPTools(tools: MCPTool[]) {
  localStorage.setItem("zeqouxchat-mcp-tools", JSON.stringify(tools));
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function getToolDefinitions(): ToolDefinition[] {
  const tools = loadTools().filter((t) => t.enabled);
  return tools.map((t) => {
    const base: ToolDefinition = {
      type: "function",
      function: { name: t.id, description: t.description, parameters: {} },
    };
    switch (t.id) {
      case "read-file":
        base.function.parameters = {
          type: "object", required: ["path"],
          properties: { path: { type: "string", description: "Absolute path to the file, or a path relative to the current project root" } },
        };
        break;
      case "write-file":
        base.function.parameters = {
          type: "object", required: ["path", "content"],
          properties: {
            path: { type: "string", description: "Absolute path to the file, or a path relative to the current project root" },
            content: { type: "string", description: "Content to write to the file" },
          },
        };
        break;
      case "list-dir":
        base.function.parameters = {
          type: "object", required: ["path"],
          properties: { path: { type: "string", description: "Absolute path to the directory, or a path relative to the current project root" } },
        };
        break;
      case "web-search":
        base.function.parameters = {
          type: "object", required: ["query"],
          properties: { query: { type: "string", description: "Search query for the web" } },
        };
        break;
      case "fetch-url":
        base.function.parameters = {
          type: "object", required: ["url"],
          properties: { url: { type: "string", description: "URL to fetch content from" } },
        };
        break;
      case "run-code":
        base.function.parameters = {
          type: "object", required: ["code"],
          properties: { code: { type: "string", description: "JavaScript code to execute" } },
        };
        break;
      case "terminal":
        base.function.parameters = {
          type: "object", required: ["command"],
          properties: { command: { type: "string", description: "Shell command to run" } },
        };
        break;
      case "train-model":
        base.function.parameters = {
          type: "object", required: ["name", "dataset_path"],
          properties: {
            name: { type: "string", description: "Model name for the trained model" },
            mode: { type: "string", enum: ["scratch", "lora"], description: "Training mode: scratch (from scratch) or lora (fine-tune)" },
            dataset_path: { type: "string", description: "Path to dataset file (JSON/CSV) or 'builtin' for default" },
            base_model: { type: "string", description: "Base model for LoRA fine-tuning (e.g. Qwen/Qwen2.5-7B-Instruct)" },
            epochs: { type: "number", description: "Number of training epochs" },
          },
        };
        break;
      case "list-tools":
        base.function.parameters = {
          type: "object", properties: {},
        };
        break;
      case "delete-file":
        base.function.parameters = {
          type: "object", required: ["path"],
          properties: { path: { type: "string", description: "Path to file/directory to delete" } },
        };
        break;
      case "create-directory":
        base.function.parameters = {
          type: "object", required: ["path"],
          properties: { path: { type: "string", description: "Directory path to create (parents auto-created)" } },
        };
        break;
      case "copy-file":
        base.function.parameters = {
          type: "object", required: ["source", "destination"],
          properties: {
            source: { type: "string", description: "Source file path" },
            destination: { type: "string", description: "Destination file path" },
          },
        };
        break;
      case "move-file":
        base.function.parameters = {
          type: "object", required: ["source", "destination"],
          properties: {
            source: { type: "string", description: "Source path" },
            destination: { type: "string", description: "Destination path" },
          },
        };
        break;
      case "file-stat":
        base.function.parameters = {
          type: "object", required: ["path"],
          properties: { path: { type: "string", description: "Path to get info for" } },
        };
        break;
      case "search-files":
        base.function.parameters = {
          type: "object", required: ["query"],
          properties: {
            query: { type: "string", description: "Search term (filename or content)" },
            path: { type: "string", description: "Directory to search in (default: project root '.')" },
          },
        };
        break;
      case "git-status":
        base.function.parameters = {
          type: "object", properties: { path: { type: "string", description: "Project path (default: root)" } },
        };
        break;
      case "git-diff":
        base.function.parameters = {
          type: "object", properties: { path: { type: "string", description: "Project path (default: root)" } },
        };
        break;
      case "git-log":
        base.function.parameters = {
          type: "object", properties: {
            path: { type: "string", description: "Project path" },
            limit: { type: "number", description: "Number of commits (default 10)" },
          },
        };
        break;
      case "git-commit":
        base.function.parameters = {
          type: "object", required: ["message"],
          properties: {
            message: { type: "string", description: "Commit message" },
            path: { type: "string", description: "Project path" },
          },
        };
        break;
      case "system-info":
        base.function.parameters = { type: "object", properties: {} };
        break;
      case "open-in-explorer":
        base.function.parameters = {
          type: "object", required: ["path"],
          properties: { path: { type: "string", description: "Folder/file path to open in OS file manager" } },
        };
        break;
      case "run-python":
        base.function.parameters = {
          type: "object", required: ["code"],
          properties: { code: { type: "string", description: "Python code to execute" } },
        };
        break;
      case "format-code":
        base.function.parameters = {
          type: "object", required: ["code"],
          properties: {
            code: { type: "string", description: "Code to format" },
            language: { type: "string", description: "Language (js, ts, python, etc.)" },
          },
        };
        break;
      case "summarize-file":
        base.function.parameters = {
          type: "object", required: ["path"],
          properties: { path: { type: "string", description: "File path to summarize" } },
        };
        break;
      case "add-memory":
        base.function.parameters = {
          type: "object", required: ["content"],
          properties: {
            content: { type: "string", description: "Memory content to save" },
            title: { type: "string", description: "Short title" },
            type: { type: "string", enum: ["fact","preference","task","project","user","custom"], description: "Memory type" },
            importance: { type: "string", enum: ["low","medium","high"], description: "Importance" },
            tags: { type: "string", description: "Comma-separated tags" },
          },
        };
        break;
      case "list-memory":
        base.function.parameters = { type: "object", properties: {} };
        break;
      case "search-memory":
        base.function.parameters = {
          type: "object", required: ["query"],
          properties: { query: { type: "string", description: "Search query" } },
        };
        break;
      case "update-memory":
        base.function.parameters = {
          type: "object", required: ["id"],
          properties: {
            id: { type: "string", description: "Memory id to update" },
            content: { type: "string", description: "New content" },
            importance: { type: "string", enum: ["low","medium","high"] },
          },
        };
        break;
      case "remove-memory":
        base.function.parameters = {
          type: "object", required: ["id"],
          properties: { id: { type: "string", description: "Memory id to delete" } },
        };
        break;
      case "clear-memory":
        base.function.parameters = {
          type: "object", properties: { onlyUnpinned: { type: "boolean", description: "If true, keep pinned memories" } },
        };
        break;
    }
    return base;
  });
}

function nope(error: string): MCPResult {
  return { success: false, output: "", error, duration: 0 };
}

let _defaultWorkspace: string | null = null;

// ── Browser fallback: File System Access API handle ───────────────────────
let _browserDirHandle: any = null;
export function setBrowserDirHandle(handle: any) {
  _browserDirHandle = handle;
  try { (window as any).__zeqoux_handle = handle; } catch {}
  try { localStorage.setItem("zeqouxchat-browser-handle-name", handle?.name || "browser-project"); } catch {}
  // async persist to IDB (fire-and-forget)
  saveHandleToIDB(handle).catch(()=>{});
}
export function getBrowserDirHandle(): any {
  if (_browserDirHandle) return _browserDirHandle;
  try { return (window as any).__zeqoux_handle || null; } catch { return null; }
}
export function hasBrowserHandle(): boolean { return !!getBrowserDirHandle(); }
export function getBrowserProjectName(): string {
  try { return localStorage.getItem("zeqouxchat-browser-handle-name") || ""; } catch { return ""; }
}

// ── IndexedDB persistence for directory handle (survives reload) ──────────
const HANDLE_DB = "zeqoux-fs";
const HANDLE_STORE = "handles";
function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      try { req.result.createObjectStore(HANDLE_STORE); } catch {}
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveHandleToIDB(handle: any): Promise<void> {
  try {
    const db = await openHandleDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).put(handle, "dir");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {}
}
async function loadHandleFromIDB(): Promise<any> {
  try {
    const db = await openHandleDB();
    const handle = await new Promise<any>((res, rej) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const req = tx.objectStore(HANDLE_STORE).get("dir");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    // verify permission still granted
    if (handle) {
      try {
        const perm = await handle.queryPermission?.({ mode: "readwrite" });
        if (perm === "granted" || perm === undefined) return handle;
        const reqPerm = await handle.requestPermission?.({ mode: "readwrite" });
        if (reqPerm === "granted") return handle;
      } catch {}
      return handle; // still return, may prompt later
    }
    return handle;
  } catch { return null; }
}
export async function initBrowserHandle(): Promise<any> {
  if (_browserDirHandle) return _browserDirHandle;
  try {
    const h = (window as any).__zeqoux_handle;
    if (h) { _browserDirHandle = h; return h; }
  } catch {}
  const saved = await loadHandleFromIDB();
  if (saved) {
    _browserDirHandle = saved;
    try { (window as any).__zeqoux_handle = saved; } catch {}
    try { localStorage.setItem("zeqouxchat-browser-handle-name", saved.name || "project"); } catch {}
    return saved;
  }
  return null;
}
async function persistBrowserHandle(handle: any) {
  _browserDirHandle = handle;
  try { (window as any).__zeqoux_handle = handle; } catch {}
  try { localStorage.setItem("zeqouxchat-browser-handle-name", handle?.name || "browser-project"); } catch {}
  await saveHandleToIDB(handle);
}

export async function getDefaultWorkspace(): Promise<string> {
  if (_defaultWorkspace) return _defaultWorkspace;
  try {
    const { appDataDir } = await import("@tauri-apps/api/path");
    const dir = await appDataDir();
    _defaultWorkspace = dir.replace(/\\/g, "/").replace(/\/+$/, "") + "/workspace";
  } catch {
    // browser: use handle-based virtual workspace marker
    if (hasBrowserHandle()) {
      _defaultWorkspace = `browser://${getBrowserProjectName() || "project"}`;
    } else {
      _defaultWorkspace = "";
    }
  }
  return _defaultWorkspace;
}

// ── helpers for File System Access API (browser) ──────────────────────────
async function getBrowserHandleForPath(relativePath: string, createDirs = false): Promise<{ handle: any; fileName: string } | null> {
  const root = getBrowserDirHandle();
  if (!root) return null;
  const parts = normalizeSeparators(relativePath).replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length === 0) return { handle: root, fileName: "" };
  const fileName = parts.pop() as string;
  let dir = root;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part, { create: createDirs });
    } catch {
      return null;
    }
  }
  return { handle: dir, fileName };
}
async function browserWriteFile(relativePath: string, content: string): Promise<void> {
  const root = getBrowserDirHandle();
  if (!root) throw new Error("No browser directory handle");
  const parts = normalizeSeparators(relativePath).replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length === 0) throw new Error("Invalid path");
  const fileName = parts.pop() as string;
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable: any = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
async function browserReadFile(relativePath: string): Promise<string> {
  const entry = await getBrowserHandleForPath(relativePath, false);
  if (!entry) throw new Error(`File not found: ${relativePath}`);
  const { handle, fileName } = entry;
  const fileHandle = await handle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return await file.text();
}
async function browserListDir(relativePath: string): Promise<string> {
  const root = getBrowserDirHandle();
  if (!root) throw new Error("No browser directory handle");
  let target: any = root;
  const clean = normalizeSeparators(relativePath).replace(/^\/+/, "").replace(/\/+$/, "");
  if (clean && clean !== "." && !clean.startsWith("browser://")) {
    const parts = clean.split("/").filter(Boolean);
    for (const part of parts) {
      target = await target.getDirectoryHandle(part, { create: false });
    }
  }
  const entries: string[] = [];
  // @ts-ignore async iterable
  for await (const [name, handle] of target.entries()) {
    const isDir = (handle as any).kind === "directory";
    entries.push(`${isDir ? "[DIR]" : "[FILE]"} ${name}`);
  }
  const displayPath = clean || getBrowserProjectName() || "project";
  return `Directory: ${displayPath}\n${entries.join("\n") || "(empty)"}`;
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

function resolveProjectPath(path: string, projectPath?: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (trimmed === "." && projectPath) {
    return normalizeSeparators(projectPath).replace(/\/+$/, "");
  }
  if (isAbsolutePath(trimmed) || !projectPath) {
    return normalizeSeparators(trimmed);
  }

  const base = normalizeSeparators(projectPath).replace(/\/+$/, "");
  const relative = normalizeSeparators(trimmed)
    .replace(/^\.\//, "")
    .replace(/^\.\\/, "")
    .replace(/^\/+/, "");
  return `${base}/${relative}`;
}

function getParentDirectory(path: string): string | null {
  const normalized = normalizeSeparators(path).replace(/\/+$/, "");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash < 0) return null;
  if (lastSlash === 0) return "/";
  if (/^[a-zA-Z]:$/.test(normalized.slice(0, lastSlash))) {
    return `${normalized.slice(0, lastSlash)}/`;
  }
  return normalized.slice(0, lastSlash);
}

async function withDuration<T>(fn: () => Promise<T>): Promise<{ data: T; duration: number }> {
  const start = performance.now();
  const data = await fn();
  return { data, duration: performance.now() - start };
}

export async function executeMCPStep(toolId: string, input: MCPFileInput): Promise<MCPResult> {
  try {
    let workspace = input.projectPath;
    if (!workspace) {
      workspace = await getDefaultWorkspace();
    }

    switch (toolId) {
      case "read-file": {
        if (!input.path) return nope("File path is required");
        const resolvedPath = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => readFile(resolvedPath));
        return { ...data, duration };
      }
      case "write-file": {
        if (!input.path || input.content === undefined) return nope("File path and content are required");
        const resolvedPath = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => writeFile(resolvedPath, input.content!));
        return { ...data, duration };
      }
      case "list-dir": {
        if (!input.path) return nope("Directory path is required");
        const resolvedPath = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => listDir(resolvedPath));
        return { ...data, duration };
      }
      case "web-search": {
        if (!input.query) return nope("Search query is required");
        const { data, duration } = await withDuration(() => webSearchMCP(input.query!));
        return { ...data, duration };
      }
      case "fetch-url": {
        if (!input.url) return nope("URL is required");
        const { data, duration } = await withDuration(() => fetchUrl(input.url!));
        return { ...data, duration };
      }
      case "run-code": {
        if (!input.code) return nope("Code is required");
        const { data, duration } = await withDuration(() => runCode(input.code!));
        return { ...data, duration };
      }
      case "terminal": {
        if (!input.command) return nope("Command is required");
        const { data, duration } = await withDuration(() => runTerminal(input.command!));
        return { ...data, duration };
      }
      case "train-model": {
        const name = input.name || "mcp_trained_model";
        const mode = input.mode || "scratch";
        const datasetPath = input.dataset_path || "builtin";
        const result = await runTraining(name, mode, datasetPath, input.base_model, input.epochs);
        return result;
      }
      case "list-tools": {
        const tools = loadTools();
        const list = tools.map((t) => `- ${t.id}: ${t.name} (${t.enabled ? "enabled" : "disabled"})`).join("\n");
        return { success: true, output: `Available MCP tools:\n${list}`, duration: 0 };
      }
      case "delete-file": {
        if (!input.path) return nope("Path is required");
        const p = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => deleteFile(p));
        return { ...data, duration };
      }
      case "create-directory": {
        if (!input.path) return nope("Path is required");
        const p = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => createDirectory(p));
        return { ...data, duration };
      }
      case "copy-file": {
        const src = (input as any).source || input.path;
        const dst = (input as any).destination;
        if (!src || !dst) return nope("source and destination required");
        const s = resolveProjectPath(src, workspace);
        const d = resolveProjectPath(dst, workspace);
        const { data, duration } = await withDuration(() => copyFile(s, d));
        return { ...data, duration };
      }
      case "move-file": {
        const src = (input as any).source || input.path;
        const dst = (input as any).destination;
        if (!src || !dst) return nope("source and destination required");
        const s = resolveProjectPath(src, workspace);
        const d = resolveProjectPath(dst, workspace);
        const { data, duration } = await withDuration(() => moveFile(s, d));
        return { ...data, duration };
      }
      case "file-stat": {
        if (!input.path) return nope("Path is required");
        const p = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => fileStat(p));
        return { ...data, duration };
      }
      case "search-files": {
        if (!input.query) return nope("query is required");
        const dir = resolveProjectPath((input as any).path || ".", workspace);
        const { data, duration } = await withDuration(() => searchFiles(dir, input.query!));
        return { ...data, duration };
      }
      case "git-status": {
        const dir = resolveProjectPath((input as any).path || ".", workspace);
        const { data, duration } = await withDuration(() => gitStatus(dir));
        return { ...data, duration };
      }
      case "git-diff": {
        const dir = resolveProjectPath((input as any).path || ".", workspace);
        const { data, duration } = await withDuration(() => gitDiff(dir));
        return { ...data, duration };
      }
      case "git-log": {
        const dir = resolveProjectPath((input as any).path || ".", workspace);
        const limit = (input as any).limit || 10;
        const { data, duration } = await withDuration(() => gitLog(dir, limit));
        return { ...data, duration };
      }
      case "git-commit": {
        if (!input.path && !(input as any).message) {
          // also check message in path fallback
        }
        const msg = (input as any).message || input.content || "";
        if (!msg) return nope("Commit message required");
        const dir = resolveProjectPath((input as any).path || ".", workspace);
        const { data, duration } = await withDuration(() => gitCommit(dir, msg));
        return { ...data, duration };
      }
      case "system-info": {
        const { data, duration } = await withDuration(() => systemInfo());
        return { ...data, duration };
      }
      case "open-in-explorer": {
        if (!input.path) return nope("Path is required");
        const p = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => openInExplorer(p));
        return { ...data, duration };
      }
      case "run-python": {
        if (!input.code) return nope("code is required");
        const { data, duration } = await withDuration(() => runPython(input.code!));
        return { ...data, duration };
      }
      case "format-code": {
        if (!input.code) return nope("code is required");
        const { data, duration } = await withDuration(() => formatCode(input.code!, (input as any).language));
        return { ...data, duration };
      }
      case "summarize-file": {
        if (!input.path) return nope("Path is required");
        const p = resolveProjectPath(input.path, workspace);
        const { data, duration } = await withDuration(() => summarizeFile(p));
        return { ...data, duration };
      }
      case "add-memory": {
        if (!input.content) return nope("content is required");
        const tags = (input as any).tags ? String((input as any).tags).split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
        const { data, duration } = await withDuration(() => addMemory(input.content!, input as any, tags));
        return { ...data, duration };
      }
      case "list-memory": {
        const { data, duration } = await withDuration(() => listMemory());
        return { ...data, duration };
      }
      case "search-memory": {
        if (!input.query) return nope("query is required");
        const { data, duration } = await withDuration(() => searchMemory(input.query!));
        return { ...data, duration };
      }
      case "update-memory": {
        const id = (input as any).id;
        if (!id) return nope("id is required");
        const { data, duration } = await withDuration(() => updateMemory(id, input as any));
        return { ...data, duration };
      }
      case "remove-memory": {
        const id = (input as any).id;
        if (!id) return nope("id is required");
        const { data, duration } = await withDuration(() => removeMemory(id));
        return { ...data, duration };
      }
      case "clear-memory": {
        const onlyUnpinned = !!(input as any).onlyUnpinned;
        const { data, duration } = await withDuration(() => clearMemory(onlyUnpinned));
        return { ...data, duration };
      }
      default:
        return nope(`Unknown tool: ${toolId}`);
    }
  } catch (err: any) {
    return { success: false, output: "", error: err.message || "Unknown error", duration: 0 };
  }
}

async function readFile(path: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  const hasBrowser = hasBrowserHandle();
  // browser handle path like browser://project/...
  const isBrowserPath = path.startsWith("browser://");
  if (!isTauri && hasBrowser) {
    try {
      const rel = isBrowserPath ? path.replace(/^browser:\/\/[^\/]*\/?/, "") : path;
      // if absolute path supplied in browser, treat as relative
      const cleanRel = isAbsolutePath(rel) ? rel.split("/").pop()! : (rel || ".");
      if (cleanRel === "." || cleanRel === "") {
        const listing = await browserListDir(".");
        return { success: true, output: listing, duration: 0 };
      }
      const content = await browserReadFile(cleanRel);
      const lines = content.split("\n");
      const preview = lines.length > 100
        ? lines.slice(0, 100).join("\n") + `\n\n... (${lines.length - 100} more lines)`
        : content;
      return { success: true, output: preview, duration: 0 };
    } catch (err: any) {
      return { success: false, output: "", error: `Browser FS read failed: ${path}. ${err.message || ""} Re-attach project via папка → Select (browser picker).`, duration: 0 };
    }
  }
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const content = await readTextFile(path);
    const lines = content.split("\n");
    const preview = lines.length > 100
      ? lines.slice(0, 100).join("\n") + `\n\n... (${lines.length - 100} more lines)`
      : content;
    return { success: true, output: preview, duration: 0 };
  } catch (err: any) {
    if (!isTauri && !hasBrowser) {
      return { success: false, output: "", error: `Cannot read file in browser mode without directory handle. Выберите папку проекта через иконку папки → Select (или перетащите папку в Tauri).`, duration: 0 };
    }
    return { success: false, output: "", error: `Could not read file: ${path}. ${err.message || ""} Try re-attaching project or use relative path.`, duration: 0 };
  }
}

async function writeFile(path: string, content: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  const hasBrowser = hasBrowserHandle();
  const isBrowserPath = path.startsWith("browser://");
  if (!isTauri && hasBrowser) {
    try {
      const rel = isBrowserPath ? path.replace(/^browser:\/\/[^\/]*\/?/, "") : path;
      const cleanRel = isAbsolutePath(rel) ? rel.split("/").pop()! : rel;
      await browserWriteFile(cleanRel, content);
      return { success: true, output: `File written (browser handle): ${cleanRel || path}`, duration: 0 };
    } catch (err: any) {
      return { success: false, output: "", error: `Browser FS write failed: ${path}. ${err.message || ""}`, duration: 0 };
    }
  }
  try {
    const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
    const parentDir = getParentDirectory(path);
    if (parentDir && parentDir !== "." && !/^[a-zA-Z]:\/$/.test(parentDir) && !parentDir.startsWith("browser://")) {
      await mkdir(parentDir, { recursive: true });
    }
    await writeTextFile(path, content);
    return { success: true, output: `File written: ${path}`, duration: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isTauri && !hasBrowser) {
      // fallback to download only if no handle
      try {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").pop() || "file.txt";
        a.click();
        URL.revokeObjectURL(url);
        return { success: true, output: `Downloaded (no FS access): ${a.download} — выберите папку проекта для записи в директорию.`, duration: 0 };
      } catch {}
      return { success: false, output: "", error: `Browser: no directory handle. Выберите папку проекта через иконку папки.`, duration: 0 };
    }
    if (msg.includes("denied") || msg.includes("permission") || msg.includes("not allowed") || msg.includes("forbidden")) {
      return { success: false, output: "", error: `Permission denied: ${path}. В Tauri проверьте capabilities FS scope, в браузере — перевыберите папку.`, duration: 0 };
    }
    return { success: false, output: "", error: `Failed to write file: ${msg}.`, duration: 0 };
  }
}

async function listDir(path: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  const hasBrowser = hasBrowserHandle();
  const isBrowserPath = path.startsWith("browser://");
  if (!isTauri && hasBrowser) {
    try {
      const rel = isBrowserPath ? path.replace(/^browser:\/\/[^\/]*\/?/, "") : path;
      const cleanRel = isAbsolutePath(rel) ? "." : (rel || ".");
      const out = await browserListDir(cleanRel);
      return { success: true, output: out, duration: 0 };
    } catch (err: any) {
      return { success: false, output: "", error: `Browser FS list failed: ${path}. ${err.message}`, duration: 0 };
    }
  }
  try {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(path);
    const listing = entries.map((e: any) => {
      const isDir = e.isDirectory ? "[DIR]" : "[FILE]";
      const size = e.size ? ` (${e.size} bytes)` : "";
      return `${isDir} ${e.name}${size}`;
    }).join("\n");
    return { success: true, output: `Directory: ${path}\n${listing || "(empty)"}`, duration: 0 };
  } catch (err: any) {
    if (!isTauri && !hasBrowser) {
      return { success: false, output: "", error: `Browser: no directory handle for ${path}. Выберите папку проекта.`, duration: 0 };
    }
    return { success: false, output: "", error: `Could not list directory: ${path}. ${err.message}. Re-attach project.`, duration: 0 };
  }
}

async function webSearchMCP(query: string): Promise<MCPResult> {
  const { webSearch } = await import("./search");
  const results = await webSearch(query);
  const output = results.map((r, i) =>
    `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
  ).join("\n\n");
  return { success: true, output: output || "No results found", duration: 0 };
}

async function fetchUrl(url: string): Promise<MCPResult> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const truncated = text.length > 10000
      ? text.slice(0, 10000) + "\n\n...(truncated)"
      : text;
    return { success: true, output: truncated, duration: 0 };
  } catch (err: any) {
    return { success: false, output: "", error: `Fetch failed: ${err.message}`, duration: 0 };
  }
}

async function runCode(code: string): Promise<MCPResult> {
  try {
    const logs: string[] = [];
    const mockConsole = { log: (...args: any[]) => logs.push(args.map(String).join(" ")) };
    const fn = new Function("console", code);
    const result = fn(mockConsole);
    const output = logs.join("\n");
    return { success: true, output: output || String(result) || "(no output)", duration: 0 };
  } catch (err: any) {
    return { success: false, output: "", error: `Runtime error: ${err.message}`, duration: 0 };
  }
}

async function runTerminal(command: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  if (!isTauri) {
    return nope("Terminal требует Tauri desktop (exe). В браузере используй run-code для JS. Команда: " + command);
  }
  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const isWin = typeof navigator !== "undefined" && /Win/.test(navigator.platform || navigator.userAgent || "");
    const shell = isWin ? "cmd" : "sh";
    const args = isWin ? ["/C", command] : ["-c", command];
    const cmd = (Command as any).create(shell, args);
    const output = await cmd.execute();
    const text = [output.stdout, output.stderr].filter(Boolean).join("\n");
    return {
      success: output.code === 0,
      output: text || "(no output)",
      error: output.code !== 0 ? `Exit code: ${output.code}` : undefined,
      duration: 0,
    };
  } catch (err: any) {
    return { success: false, output: "", error: `Terminal error: ${err.message}`, duration: 0 };
  }
}

async function runTraining(name: string, mode: string, datasetPath: string, baseModel?: string, epochs?: number): Promise<MCPResult> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const aiensDir = await invoke<string>("get_aiens_dir");
    const datasetArg = datasetPath === "builtin" ? "" : datasetPath;

    const pythonCode = `
import json, sys, subprocess, os
aiens_dir = ${JSON.stringify(aiensDir)}
worker = os.path.join(aiens_dir, 'training_worker.py')
lora_worker = os.path.join(aiens_dir, 'lora_trainer.py')
mode = ${JSON.stringify(mode)}
if mode == 'lora' and os.path.exists(lora_worker):
    worker = lora_worker
if not os.path.exists(worker):
    print(json.dumps({"event":"error","detail":"Training worker not found"}))
    sys.exit(1)
job = {
    "id": "mcp_job",
    "output_dir": os.path.join(aiens_dir, "trained_models", ${JSON.stringify(name)}),
    "config": {
        "name": ${JSON.stringify(name)},
        "mode": mode,
        "dataset_path": ${JSON.stringify(datasetArg)} or os.path.join(aiens_dir, "datasets", "default_dataset_v1.json"),
        "base_model": ${JSON.stringify(baseModel || "")},
        "epochs": ${epochs || 3},
        "batch_size": 8,
        "learning_rate": 0.0003,
        "max_length": 128,
    }
}
os.makedirs(os.path.join(aiens_dir, "training_jobs"), exist_ok=True)
os.makedirs(job["output_dir"], exist_ok=True)
job_file = os.path.join(aiens_dir, "training_jobs", job["id"]+".json")
with open(job_file, "w", encoding="utf-8") as f:
    json.dump(job, f, ensure_ascii=False, indent=2)
result = subprocess.run([sys.executable, worker, "--job", job_file], capture_output=True, text=True, timeout=3600)
out = result.stdout.strip()
err = result.stderr.strip()[:1000] if result.stderr else ""
print(out)
if err:
    print(json.dumps({"event":"stderr","detail":err}))
`;

    const { Command } = await import("@tauri-apps/plugin-shell");
    const py = (Command as any).create("python", ["-c", pythonCode]);
    let output: any;
    try {
      output = await py.execute();
    } catch {
      const py3 = (Command as any).create("python3", ["-c", pythonCode]);
      output = await py3.execute();
    }
    const fullOutput = [output.stdout, output.stderr].filter(Boolean).join("\n").trim();

    if (output.code === 0) {
      return {
        success: true,
        output: `Training complete! Model saved as: ${name}\n${fullOutput.slice(0, 2000)}`,
        duration: 0,
      };
    }
    return {
      success: false,
      output: "",
      error: `Training failed (exit ${output.code}): ${fullOutput.slice(0, 1000)}`,
      duration: 0,
    };
  } catch (err: any) {
    return { success: false, output: "", error: `Training error: ${err.message}`, duration: 0 };
  }
}

// ── Extended helpers ────────────────────────────────────────────────────
async function deleteFile(path: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  const hasBrowser = hasBrowserHandle();
  const isBrowserPath = path.startsWith("browser://");
  if (!isTauri && hasBrowser) {
    try {
      const rel = isBrowserPath ? path.replace(/^browser:\/\/[^\/]*\/?/, "") : path;
      const entry = await getBrowserHandleForPath(rel, false);
      if (!entry) throw new Error("File not found");
      await entry.handle.removeEntry(entry.fileName, { recursive: true });
      return { success: true, output: `Deleted (browser): ${rel}`, duration: 0 };
    } catch (e:any) { return { success: false, output: "", error: `Browser delete failed: ${e.message}`, duration: 0 }; }
  }
  try {
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(path);
    return { success: true, output: `Deleted: ${path}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `Delete failed: ${e.message}`, duration: 0 }; }
}
async function createDirectory(path: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  const hasBrowser = hasBrowserHandle();
  const isBrowserPath = path.startsWith("browser://");
  if (!isTauri && hasBrowser) {
    try {
      const rel = isBrowserPath ? path.replace(/^browser:\/\/[^\/]*\/?/, "") : path;
      if (!rel || rel==="." ) return { success: true, output: `Directory exists (browser): ${rel}`, duration: 0 };
      const parts = normalizeSeparators(rel).replace(/^\/+/,"").split("/").filter(Boolean);
      let dir = getBrowserDirHandle();
      for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
      return { success: true, output: `Directory created (browser): ${rel}`, duration: 0 };
    } catch (e:any) { return { success: false, output: "", error: `Browser mkdir failed: ${e.message}`, duration: 0 }; }
  }
  try {
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir(path, { recursive: true });
    return { success: true, output: `Directory created: ${path}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `Mkdir failed: ${e.message}`, duration: 0 }; }
}
async function copyFile(src: string, dst: string): Promise<MCPResult> {
  try {
    const isTauri = isTauriEnv();
    if (isTauri) {
      const { copyFile: cp } = await import("@tauri-apps/plugin-fs");
      await cp(src, dst);
      return { success: true, output: `Copied: ${src} → ${dst}`, duration: 0 };
    }
    // browser: read + write
    const content = await browserReadFile(src.replace(/^browser:\/\/[^\/]*\/?/, ""));
    await browserWriteFile(dst.replace(/^browser:\/\/[^\/]*\/?/, ""), content);
    return { success: true, output: `Copied (browser): ${src} → ${dst}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `Copy failed: ${e.message}`, duration: 0 }; }
}
async function moveFile(src: string, dst: string): Promise<MCPResult> {
  try {
    const isTauri = isTauriEnv();
    if (isTauri) {
      try {
        const { rename } = await import("@tauri-apps/plugin-fs");
        await (rename as any)(src, dst);
        return { success: true, output: `Moved: ${src} → ${dst}`, duration: 0 };
      } catch {
        const { copyFile: cp, remove } = await import("@tauri-apps/plugin-fs");
        await cp(src, dst);
        await remove(src);
        return { success: true, output: `Moved (copy+delete): ${src} → ${dst}`, duration: 0 };
      }
    }
    const content = await browserReadFile(src.replace(/^browser:\/\/[^\/]*\/?/, ""));
    await browserWriteFile(dst.replace(/^browser:\/\/[^\/]*\/?/, ""), content);
    // delete src
    const entry = await getBrowserHandleForPath(src.replace(/^browser:\/\/[^\/]*\/?/, ""), false);
    if (entry) await entry.handle.removeEntry(entry.fileName);
    return { success: true, output: `Moved (browser): ${src} → ${dst}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `Move failed: ${e.message}`, duration: 0 }; }
}
async function fileStat(path: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  if (isTauri) {
    try {
      const { stat } = await import("@tauri-apps/plugin-fs");
      const s: any = await stat(path);
      return { success: true, output: `Stat: ${path}\nSize: ${s.size ?? "?"} bytes\nisDir: ${s.isDirectory ?? s.is_directory ?? "?"} \nmode: ${s.mode ?? "?"}`, duration: 0 };
    } catch (e:any) { return { success: false, output: "", error: `Stat failed: ${e.message}`, duration: 0 }; }
  }
  // browser: try to get handle stat
  try {
    const rel = path.replace(/^browser:\/\/[^\/]*\/?/, "");
    const entry = await getBrowserHandleForPath(rel, false);
    if (!entry) throw new Error("Not found");
    const h = await entry.handle.getFileHandle(entry.fileName);
    const f: any = await h.getFile();
    return { success: true, output: `Stat (browser): ${rel}\nSize: ${f.size} bytes\nModified: ${new Date(f.lastModified).toISOString()}`, duration: 0 };
  } catch {
    // try as dir
    try {
      const rel = path.replace(/^browser:\/\/[^\/]*\/?/, "") || ".";
      const root = getBrowserDirHandle();
      let target = root;
      if (rel !== "." ) {
        const parts = rel.split("/").filter(Boolean);
        for (const p of parts) target = await target.getDirectoryHandle(p);
      }
      return { success: true, output: `Stat (browser): ${rel} [DIR]`, duration: 0 };
    } catch (e:any) { return { success: false, output: "", error: `Stat failed: ${e.message}`, duration: 0 }; }
  }
}
async function searchFiles(dir: string, query: string): Promise<MCPResult> {
  const isBrowser = dir.startsWith("browser://") || hasBrowserHandle();
  try {
    if (isBrowser && hasBrowserHandle()) {
      const handle = getBrowserDirHandle();
      const results: string[] = [];
      async function walk(h:any, prefix:string) {
        for await (const [name, entry] of h.entries()) {
          const p = prefix ? `${prefix}/${name}` : name;
          if (name.toLowerCase().includes(query.toLowerCase())) results.push(p);
          if ((entry as any).kind === "directory" && results.length < 100) await walk(entry, p);
          else if ((entry as any).kind === "file" && results.length < 100) {
            try {
              const fh = await h.getFileHandle(name);
              const f = await fh.getFile();
              const txt = await f.text();
              if (txt.toLowerCase().includes(query.toLowerCase())) results.push(`${p} (content match)`);
            } catch {}
          }
          if (results.length >= 50) break;
        }
      }
      let start = handle;
      const sub = dir.replace(/^browser:\/\/[^\/]*\/?/, "").replace(/^\.\/?/, "");
      if (sub && sub !== ".") {
        const parts = sub.split("/").filter(Boolean);
        for (const p of parts) start = await start.getDirectoryHandle(p);
      }
      await walk(start, sub || "");
      return { success: true, output: results.length ? `Found ${results.length}:\n` + results.join("\n") : `No matches for "${query}"`, duration: 0 };
    }
    // Tauri: use scanProjectTree + simple grep
    const { scanProjectTree } = await import("./project-scanner");
    const tree = await scanProjectTree(dir);
    const matches: string[] = [];
    function collect(entries:any[], base:string) {
      for (const e of entries) {
        const full = base ? `${base}/${e.name}` : e.name;
        if (e.name.toLowerCase().includes(query.toLowerCase())) matches.push(full);
        if (e.children) collect(e.children, full);
        if (matches.length >= 50) break;
      }
    }
    collect(tree as any, "");
    // also grep file contents for first 20 files
    if (matches.length < 20) {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      async function grepContent(entries:any[], base:string) {
        for (const e of entries) {
          if (e.isDir && e.children) await grepContent(e.children, base ? `${base}/${e.name}` : e.name);
          else if (!e.isDir) {
            try {
              const p = e.path;
              const txt = await readTextFile(p);
              if (txt.toLowerCase().includes(query.toLowerCase())) matches.push(`${base ? base+"/" : ""}${e.name} (content)`);
            } catch {}
            if (matches.length >= 50) break;
          }
        }
      }
      await grepContent(tree as any, "");
    }
    return { success: true, output: matches.length ? `Found ${matches.length}:\n` + matches.slice(0,50).join("\n") : `No matches for "${query}" in ${dir}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `Search failed: ${e.message}`, duration: 0 }; }
}
async function gitStatus(dir: string): Promise<MCPResult> {
  const c = `git -C "${dir.replace(/"/g, '\\"')}" status --porcelain=v1 -b`;
  const r = await runTerminal(c);
  return r.success ? { ...r, output: r.output || "(clean)" } : r;
}
async function gitDiff(dir: string): Promise<MCPResult> {
  const c = `git -C "${dir.replace(/"/g, '\\"')}" diff --stat && echo "---" && git -C "${dir.replace(/"/g, '\\"')}" diff`;
  const r = await runTerminal(c);
  return r;
}
async function gitLog(dir: string, limit: number): Promise<MCPResult> {
  const c = `git -C "${dir.replace(/"/g, '\\"')}" log --oneline -n ${Math.min(limit,50)} --decorate`;
  const r = await runTerminal(c);
  return r;
}
async function gitCommit(dir: string, message: string): Promise<MCPResult> {
  const safeMsg = message.replace(/"/g, '\\"');
  const c = `git -C "${dir.replace(/"/g, '\\"')}" commit -m "${safeMsg}"`;
  const r = await runTerminal(c);
  return r;
}
async function systemInfo(): Promise<MCPResult> {
  const nav: any = typeof navigator !== "undefined" ? navigator : {};
  const info = [
    `Platform: ${nav.platform || "?"} / ${nav.userAgent || "?"}`,
    `Language: ${nav.language || "?"}`,
    `Cores: ${nav.hardwareConcurrency || "?"}`,
    `Memory: ${(nav as any).deviceMemory ? (nav as any).deviceMemory + " GB" : "?"}`,
    `Screen: ${typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "?"}`,
    `URL: ${typeof location !== "undefined" ? location.href : "?"}`,
  ].join("\n");
  // try Tauri info
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const tauriInfo = await invoke<string>("get_app_info").catch(()=> "");
    return { success: true, output: info + (tauriInfo ? `\nTauri: ${tauriInfo}` : ""), duration: 0 };
  } catch {}
  return { success: true, output: info, duration: 0 };
}
async function openInExplorer(path: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  if (!isTauri) return { success: false, output: "", error: "Open in Explorer требует Tauri desktop", duration: 0 };
  try {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(path);
    return { success: true, output: `Opened: ${path}`, duration: 0 };
  } catch (e:any) {
    // fallback via shell
    const r = await runTerminal(`explorer "${path.replace(/"/g,'""')}" || xdg-open "${path}" || open "${path}"`);
    return r;
  }
}
async function runPython(code: string): Promise<MCPResult> {
  const isTauri = isTauriEnv();
  if (!isTauri) return { success: false, output: "", error: "Run Python требует Tauri. Используй run-code для JS.", duration: 0 };
  try {
    // Use the interpreter chosen in Settings (venv if present); fall back to
    // PATH python only when the user has not configured anything yet.
    const pyExe = pythonEnv.activeExecutable();
    let out: any;
    if (pyExe) {
      const { invoke, } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const lines: string[] = [];
      const un = await listen<[string, string]>("proc-log", (e) => { if (e.payload[0] === "mcp-python") lines.push(e.payload[1]); });
      await new Promise<number | null>((resolve) => {
        const unExit = listen<[string, number | null]>("proc-exit", (e) => {
          if (e.payload[0] === "mcp-python") { unExit.then((f) => f()); resolve(e.payload[1]); }
        });
        invoke("proc_start", { id: "mcp-python", program: pyExe, args: ["-c", code], cwd: null })
          .catch(() => resolve(null));
      });
      un();
      const txt = lines.join("\n");
      return { success: true, output: txt || "(no output)", duration: 0 };
    }
    const { Command } = await import("@tauri-apps/plugin-shell");
    try {
      out = await (Command as any).create("python", ["-c", code]).execute();
    } catch {
      out = await (Command as any).create("python3", ["-c", code]).execute();
    }
    const txt = [out.stdout, out.stderr].filter(Boolean).join("\n");
    return { success: out.code === 0, output: txt || "(no output)", error: out.code !== 0 ? `Exit ${out.code}` : undefined, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `Python error: ${e.message}`, duration: 0 }; }
}
async function formatCode(code: string, language?: string): Promise<MCPResult> {
  // simple: trim trailing spaces, ensure newline at end
  const formatted = code.split("\n").map(l=> l.replace(/\s+$/,"")).join("\n").trimEnd() + "\n";
  return { success: true, output: formatted, duration: 0 };
}
async function summarizeFile(path: string): Promise<MCPResult> {
  const r = await readFile(path);
  if (!r.success) return r;
  const txt = r.output;
  const lines = txt.split("\n");
  const head = lines.slice(0, 30).join("\n");
  const summary = `Summary of ${path} (${lines.length} lines, ~${txt.length} chars):\n\n${head.slice(0, 1500)}${txt.length > 1500 ? "\n...(truncated)" : ""}`;
  return { success: true, output: summary, duration: 0 };
}

async function addMemory(content: string, input: any, tags: string[]): Promise<MCPResult> {
  try {
    const { memoryService } = await import("./memory");
    const s = memoryService.getSettings();
    if (!s.allowAIWrite) return { success: false, output: "", error: "AI write to memory is disabled in settings", duration: 0 };
    const entry = memoryService.add(content, {
      title: input.title,
      type: (input.type as any) || "custom",
      importance: (input.importance as any) || "medium",
      tags,
      pinned: !!input.pinned,
      sourceChatId: input.projectPath || undefined,
    });
    if (!entry) return { success: false, output: "", error: "Memory disabled or duplicate", duration: 0 };
    return { success: true, output: `Memory saved: ${entry.id}\n${entry.content}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `add-memory failed: ${e.message}`, duration: 0 }; }
}
async function listMemory(): Promise<MCPResult> {
  try {
    const { memoryService } = await import("./memory");
    const all = memoryService.list();
    if (all.length === 0) return { success: true, output: "(no memories)", duration: 0 };
    const out = all.slice(0, 30).map(e => `- ${e.id} [${e.type}/${e.importance}${e.pinned?"/pinned":""}] ${e.content} ${e.tags.length? "#"+e.tags.join(" #"):""} `).join("\n");
    return { success: true, output: `Memories (${all.length}):\n${out}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `list-memory failed: ${e.message}`, duration: 0 }; }
}
async function searchMemory(query: string): Promise<MCPResult> {
  try {
    const { memoryService } = await import("./memory");
    const res = memoryService.search(query);
    if (res.length === 0) return { success: true, output: `No memories for "${query}"`, duration: 0 };
    const out = res.slice(0, 20).map(e => `- ${e.id}: ${e.content}`).join("\n");
    return { success: true, output: `Found ${res.length}:\n${out}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `search-memory failed: ${e.message}`, duration: 0 }; }
}
async function updateMemory(id: string, patch: any): Promise<MCPResult> {
  try {
    const { memoryService } = await import("./memory");
    const upd: any = {};
    if (patch.content) upd.content = patch.content;
    if (patch.importance) upd.importance = patch.importance;
    if (patch.tags) upd.tags = String(patch.tags).split(",").map((s:string)=>s.trim()).filter(Boolean);
    const e = memoryService.update(id, upd);
    if (!e) return { success: false, output: "", error: `Memory ${id} not found`, duration: 0 };
    return { success: true, output: `Updated ${id}: ${e.content}`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `update-memory failed: ${e.message}`, duration: 0 }; }
}
async function removeMemory(id: string): Promise<MCPResult> {
  try {
    const { memoryService } = await import("./memory");
    const s = memoryService.getSettings();
    if (!s.allowAIDelete) return { success: false, output: "", error: "AI delete disabled in settings", duration: 0 };
    const ok = memoryService.remove(id);
    return ok ? { success: true, output: `Deleted ${id}`, duration: 0 } : { success: false, output: "", error: `Memory ${id} not found`, duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `remove-memory failed: ${e.message}`, duration: 0 }; }
}
async function clearMemory(onlyUnpinned: boolean): Promise<MCPResult> {
  try {
    const { memoryService } = await import("./memory");
    memoryService.clear(onlyUnpinned);
    return { success: true, output: onlyUnpinned ? "Cleared unpinned memories" : "Cleared all memories", duration: 0 };
  } catch (e:any) { return { success: false, output: "", error: `clear-memory failed: ${e.message}`, duration: 0 }; }
}
