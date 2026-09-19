export type MemoryImportance = "low" | "medium" | "high";
export type MemoryType = "fact" | "preference" | "task" | "project" | "user" | "custom";

export interface MemoryEntry {
  id: string;
  content: string;
  title?: string;
  type: MemoryType;
  importance: MemoryImportance;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  sourceChatId?: string;
}

export interface MemorySettings {
  enabled: boolean;
  autoCapture: boolean;
  maxEntries: number;
  retentionDays: number; // 0 = forever
  allowAIWrite: boolean;
  allowAIDelete: boolean;
  includeInContext: boolean;
  maxContextEntries: number;
}

const STORAGE_KEY = "zeqoux-memory";
const SETTINGS_KEY = "zeqoux-memory-settings";

const DEFAULT_SETTINGS: MemorySettings = {
  enabled: true,
  autoCapture: true,
  maxEntries: 500,
  retentionDays: 0,
  allowAIWrite: true,
  allowAIDelete: true,
  includeInContext: true,
  maxContextEntries: 10,
};

function loadEntries(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MemoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveEntries(entries: MemoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function loadSettings(): MemorySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s: MemorySettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

function genId() { return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export const memoryService = {
  subscribe: (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); },
  getState: () => ({ entries: loadEntries(), settings: loadSettings() }),

  getSettings: () => loadSettings(),
  updateSettings: (patch: Partial<MemorySettings>) => {
    const s = { ...loadSettings(), ...patch };
    saveSettings(s);
    notify();
    return s;
  },

  list: (): MemoryEntry[] => {
    const all = loadEntries();
    // apply retention
    const settings = loadSettings();
    if (settings.retentionDays > 0) {
      const cutoff = Date.now() - settings.retentionDays * 86400000;
      const filtered = all.filter(e => new Date(e.updatedAt).getTime() > cutoff || e.pinned);
      if (filtered.length !== all.length) {
        saveEntries(filtered);
        return filtered;
      }
    }
    return [...all].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const imp = { high: 3, medium: 2, low: 1 };
      if (imp[a.importance] !== imp[b.importance]) return imp[b.importance] - imp[a.importance];
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },

  search: (query: string): MemoryEntry[] => {
    const q = query.toLowerCase().trim();
    if (!q) return memoryService.list();
    return memoryService.list().filter(e =>
      e.content.toLowerCase().includes(q) ||
      (e.title && e.title.toLowerCase().includes(q)) ||
      e.tags.some(t => t.toLowerCase().includes(q))
    );
  },

  add: (content: string, opts?: Partial<Omit<MemoryEntry, "id" | "content" | "createdAt" | "updatedAt">> & { sourceChatId?: string }): MemoryEntry | null => {
    const settings = loadSettings();
    if (!settings.enabled) return null;
    if (!settings.allowAIWrite && opts?.sourceChatId) {
      // AI trying to write but not allowed - still allow user writes (no sourceChatId)
      // For now, respect setting for all
      if (!settings.allowAIWrite) return null;
    }
    const trimmed = content.trim();
    if (!trimmed) return null;
    // dedupe: if same content exists, update instead
    const all = loadEntries();
    const existing = all.find(e => e.content.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      saveEntries(all);
      notify();
      return existing;
    }
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: genId(),
      content: trimmed,
      title: opts?.title?.trim() || trimmed.slice(0, 50),
      type: opts?.type || "custom",
      importance: opts?.importance || "medium",
      tags: opts?.tags || [],
      pinned: opts?.pinned || false,
      createdAt: now,
      updatedAt: now,
      sourceChatId: opts?.sourceChatId,
    };
    // enforce maxEntries (remove oldest low importance first)
    if (all.length >= settings.maxEntries) {
      const sorted = [...all].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? 1 : -1;
        const imp = { low: 1, medium: 2, high: 3 };
        return imp[a.importance] - imp[b.importance] || new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      });
      const toRemove = sorted.slice(0, all.length - settings.maxEntries + 1).map(e => e.id);
      const remaining = all.filter(e => !toRemove.includes(e.id));
      remaining.unshift(entry);
      saveEntries(remaining);
    } else {
      all.unshift(entry);
      saveEntries(all);
    }
    notify();
    return entry;
  },

  update: (id: string, patch: Partial<Omit<MemoryEntry, "id" | "createdAt">>): MemoryEntry | null => {
    const all = loadEntries();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    saveEntries(all);
    notify();
    return all[idx];
  },

  remove: (id: string): boolean => {
    const settings = loadSettings();
    // check if AI allowed to delete - caller should check source, but we enforce setting
    // For now, allow if settings.allowAIDelete or if it's user-initiated (we can't distinguish, so allow)
    // The MCP tool will check setting before calling
    const all = loadEntries();
    const filtered = all.filter(e => e.id !== id);
    if (filtered.length === all.length) return false;
    saveEntries(filtered);
    notify();
    return true;
  },

  clear: (onlyUnpinned = false) => {
    if (onlyUnpinned) {
      const remaining = loadEntries().filter(e => e.pinned);
      saveEntries(remaining);
    } else {
      saveEntries([]);
    }
    notify();
  },

  getContextBlock: (maxEntries?: number): string => {
    const settings = loadSettings();
    if (!settings.enabled || !settings.includeInContext) return "";
    const list = memoryService.list().slice(0, maxEntries ?? settings.maxContextEntries);
    if (list.length === 0) return "";
    const lines = list.map(e => `- [${e.type}/${e.importance}${e.pinned ? "/pinned" : ""}] ${e.content}${e.tags.length ? ` #${e.tags.join(" #")}` : ""}`);
    return `Memory (long-term, ${list.length} entries):\n${lines.join("\n")}`;
  },

  export: (): string => JSON.stringify(loadEntries(), null, 2),
  import: (json: string): number => {
    try {
      const arr = JSON.parse(json);
      if (!Array.isArray(arr)) throw new Error("not array");
      const existing = loadEntries();
      const map = new Map(existing.map(e => [e.id, e]));
      let added = 0;
      for (const item of arr) {
        if (!item.content) continue;
        const id = item.id || genId();
        if (map.has(id)) continue;
        map.set(id, { ...item, id, createdAt: item.createdAt || new Date().toISOString(), updatedAt: item.updatedAt || new Date().toISOString() });
        added++;
      }
      saveEntries(Array.from(map.values()));
      notify();
      return added;
    } catch { return 0; }
  },
};
