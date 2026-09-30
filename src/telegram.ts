export function bindTelegramReady(script: Pick<HTMLScriptElement, "addEventListener" | "removeEventListener"> | null,
  getApp = () => window.Telegram?.WebApp) {
  let initialized = false;
  const ready = () => {
    const app = getApp();
    if (!app || initialized) return;
    initialized = true;
    app.ready();
    app.expand();
  };
  script?.addEventListener("load", ready);
  ready();
  return () => script?.removeEventListener("load", ready);
}
