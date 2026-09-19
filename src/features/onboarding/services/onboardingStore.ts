const FLAG = "zeqouxchat-onboarded";

interface OnboardingState {
  open: boolean;
}

let state: OnboardingState = { open: false };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const onboardingStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getState: () => state,
  isOnboarded: () => {
    try {
      return localStorage.getItem(FLAG) === "1";
    } catch {
      return true;
    }
  },
  open: () => {
    state = { open: true };
    notify();
  },
  /** User finished or skipped — never show automatically again. */
  complete: () => {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {}
    state = { open: false };
    notify();
  },
};
