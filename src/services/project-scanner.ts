export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  children?: FileEntry[];
  depth: number;
}

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", "dist", ".next", "target",
  "__pycache__", ".cache", ".turbo", "build", "out",
  ".vercel", ".netlify", "coverage", ".nyc_output",
  ".vscode", ".idea", ".DS_Store", "thumbnails",
  "Cargo.lock", "package-lock.json", "yarn.lock",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico",
  ".svg", ".webp", ".mp4", ".mp3", ".avi", ".mov",
  ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dll",
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
]);

const MAX_FILES = 2000;
const MAX_DEPTH = 10;

export async function scanProjectTree(rootPath: string, depth = 0): Promise<FileEntry[]> {
  if (depth > MAX_DEPTH) return [];
  // Browser handle support
  if (rootPath.startsWith("browser://")) {
    try {
      const { getBrowserDirHandle } = await import("./mcp");
      const rootHandle: any = getBrowserDirHandle();
      // Tauri not available, use browser handle listing
      let target: any = rootHandle;
      const sub = rootPath.replace(/^browser:\/\/[^\/]*\/?/, "").replace(/\/+$/,"");
      if (sub && target) {
        const parts = sub.split("/").filter(Boolean);
        for (const p of parts) target = await target.getDirectoryHandle(p, { create: false });
      }
      if (!target) return [];
      const results: FileEntry[] = [];
      // @ts-ignore
      for await (const [name, handle] of target.entries()) {
        if (EXCLUDED_DIRS.has(name)) continue;
        const ext = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
        if (EXCLUDED_EXTENSIONS.has(ext)) continue;
        const isDir = (handle as any).kind === "directory";
        const fullPath = rootPath.replace(/\/+$/,"") + "/" + name;
        if (isDir) {
          const children = await scanProjectTree(fullPath, depth + 1);
          if (children.length > 0 || depth < 2) results.push({ name, path: fullPath, isDir, children, depth });
        } else {
          results.push({ name, path: fullPath, isDir: false, depth });
        }
        if (results.length >= MAX_FILES) break;
      }
      return results;
    } catch { return []; }
  }
  try {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(rootPath);
    const results: FileEntry[] = [];

    for (const entry of entries.slice(0, MAX_FILES)) {
      const name = entry.name;
      if (!name) continue;

      // Skip excluded directories / files
      if (EXCLUDED_DIRS.has(name)) continue;

      const ext = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
      if (EXCLUDED_EXTENSIONS.has(ext)) continue;

      const fullPath = rootPath.replace(/\/+$/,"").replace(/\\+$/,"") + "/" + name;
      const isDir = entry.isDirectory ?? false;

      if (isDir) {
        const children = await scanProjectTree(fullPath, depth + 1);
        if (children.length > 0 || depth < 2) {
          results.push({ name, path: fullPath, isDir, children, depth });
        }
      } else {
        results.push({
          name,
          path: fullPath,
          isDir: false,
          size: (entry as any).size,
          depth,
        });
      }

      if (results.length >= MAX_FILES) break;
    }

    return results;
  } catch {
    return [];
  }
}

export function flattenFileList(entries: FileEntry[], prefix = ""): string[] {
  const lines: string[] = [];
  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const indent = "  ".repeat(entry.depth);
    const icon = entry.isDir ? "📁" : "📄";
    const sizeStr = entry.size != null ? ` (${formatSize(entry.size)})` : "";
    lines.push(`${indent}${icon} ${entry.name}${sizeStr}`);

    if (entry.children && entry.children.length > 0) {
      lines.push(...flattenFileList(entry.children, prefix));
    }
  }

  return lines;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}