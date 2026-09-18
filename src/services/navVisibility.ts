export type NavId = "hub" | "projects" | "training" | "memory" | "marketplace" | "downloads" | "extensions";

const STORAGE_KEY = "zeqoux-hidden-nav";

function loadHidden(): Set<NavId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr as NavId[]);
  } catch {
    return new Set();
  }
}

function saveHidden(hidden: Set<NavId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
}

let hidden = loadHidden();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const navVisibility = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: () => ({ hidden: new Set(hidden) }),
  getHidden: () => new Set(hidden),
  isHidden: (id: NavId) => hidden.has(id),
  isVisible: (id: NavId) => !hidden.has(id),
  hide: (id: NavId) => {
    if (hidden.has(id)) return;
    hidden.add(id);
    saveHidden(hidden);
    notify();
  },
  show: (id: NavId) => {
    if (!hidden.has(id)) return;
    hidden.delete(id);
    saveHidden(hidden);
    notify();
  },
  toggle: (id: NavId) => {
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    saveHidden(hidden);
    notify();
  },
  showAll: () => {
    if (hidden.size === 0) return;
    hidden.clear();
    saveHidden(hidden);
    notify();
  },
  setHidden: (ids: NavId[]) => {
    hidden = new Set(ids);
    saveHidden(hidden);
    notify();
  },
};
