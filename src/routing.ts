// Telegram puts launch parameters in the fragment even when no page was requested.
export function routeFromHash(hash: string): string {
  if (!hash.startsWith("#/")) return "catalog";
  return hash.slice(2).split(/[?&]/, 1)[0].replace(/\/+$/, "") || "catalog";
}
