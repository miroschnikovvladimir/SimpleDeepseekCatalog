import { expect, it, vi } from "vitest";
import { bindTelegramReady } from "./telegram";

it("shows the Mini App when its SDK arrives after the React shell", () => {
  const script = new EventTarget();
  const app = { platform: "android", ready: vi.fn(), expand: vi.fn(), sendData: vi.fn() };
  let available = false;
  const cleanup = bindTelegramReady(script, () => available ? app : undefined);
  expect(app.ready).not.toHaveBeenCalled();
  available = true;
  script.dispatchEvent(new Event("load"));
  script.dispatchEvent(new Event("load"));
  expect(app.ready).toHaveBeenCalledTimes(1);
  expect(app.expand).toHaveBeenCalledTimes(1);
  cleanup();
});

it("signals readiness immediately if the SDK is already present", () => {
  const app = { platform: "ios", ready: vi.fn(), expand: vi.fn(), sendData: vi.fn() };
  bindTelegramReady(null, () => app)();
  expect(app.ready).toHaveBeenCalledTimes(1);
});
