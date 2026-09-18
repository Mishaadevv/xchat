type Listener = () => void;

interface SettingsState {
  sendOnEnter: boolean;
  startOnBoot: boolean;
  downloadPath: string;
}

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem("zeqouxchat-settings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sendOnEnter: true, startOnBoot: false, downloadPath: "" };
}

function saveSettings(state: SettingsState) {
  localStorage.setItem("zeqouxchat-settings", JSON.stringify(state));
}

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

let autostartInitialized = false;

async function ensureAutostart() {
  if (autostartInitialized) return;
  autostartInitialized = true;
  try {
    const { isEnabled } = await import("@tauri-apps/plugin-autostart");
    const enabled = await isEnabled();
    const state = loadSettings();
    if (state.startOnBoot !== enabled) {
      state.startOnBoot = enabled;
      saveSettings(state);
      notify();
    }
  } catch {}
}

export const settingsStore = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: (): SettingsState => {
    ensureAutostart();
    return loadSettings();
  },
  setSendOnEnter: (value: boolean) => {
    const state = loadSettings();
    state.sendOnEnter = value;
    saveSettings(state);
    notify();
  },
  setStartOnBoot: async (value: boolean) => {
    const state = loadSettings();
    state.startOnBoot = value;
    saveSettings(state);
    notify();
    try {
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      if (value) {
        await enable();
      } else {
        await disable();
      }
    } catch {}
  },
  getDownloadPath: (): string => loadSettings().downloadPath,
  setDownloadPath: (path: string) => {
    const state = loadSettings();
    state.downloadPath = path;
    saveSettings(state);
    notify();
  },
};
