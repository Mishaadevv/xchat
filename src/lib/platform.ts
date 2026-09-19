export async function openUrl(url: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Desktop (Tauri) detection that works on BOTH Tauri versions:
 * v1 exposes `window.__TAURI__`, v2 exposes `window.__TAURI_INTERNALS__`.
 * Checking only `__TAURI__` misdetects the v2 desktop app as a browser.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
}
