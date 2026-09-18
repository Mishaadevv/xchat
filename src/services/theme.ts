export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "zeqouxchat-theme";

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {}
  return "light";
}

function saveTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

let current: Theme = loadTheme();
applyTheme(current);

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const themeStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: () => current,

  setTheme: (theme: Theme) => {
    current = theme;
    saveTheme(theme);
    applyTheme(theme);
    notify();
  },

  getTheme: () => current,
};

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyTheme(current);
  });
}
