export type Theme = "light" | "dark";
export type CardLayout = "large" | "compact";
export const THEME_KEY = "catalog-theme-v1";
export const ADULT_KEY = "catalog-show-adult-v1";
export const CARD_LAYOUT_KEY = "catalog-card-layout-v1";
export function readCardLayout(): CardLayout {
  try { if (localStorage.getItem(CARD_LAYOUT_KEY) === "large") return "large"; } catch { /* session choice still works */ }
  return "compact";
}
export function readTheme(): Theme {
  try { const value = localStorage.getItem(THEME_KEY); if (value === "light" || value === "dark") return value; } catch { /* session choice still works */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function readShowAdult() {
  try { return localStorage.getItem(ADULT_KEY) === "true"; } catch { return false; }
}
export function savePreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* restricted WebViews keep in-memory settings */ }
}
