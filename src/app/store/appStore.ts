import { type View } from "@/core/types";

export interface AppState {
  currentView: View;
  rightPanelOpen: boolean;
}

let state: AppState = {
  currentView: "chat",
  rightPanelOpen: false,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const appStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setView: (view: View) => {
    state = { ...state, currentView: view };
    notify();
  },
  toggleRightPanel: () => {
    state = { ...state, rightPanelOpen: !state.rightPanelOpen };
    notify();
  },
  setRightPanelOpen: (open: boolean) => {
    state = { ...state, rightPanelOpen: open };
    notify();
  },
};
