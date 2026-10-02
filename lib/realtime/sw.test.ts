// Loads the real public/sw.js in a sandbox with a fake `self` and drives its event handlers.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

type Handler = (event: Record<string, unknown>) => void;

function loadServiceWorker() {
  const handlers: Record<string, Handler> = {};
  const showNotification = vi.fn(async (title: string, options?: NotificationOptions) => {
    void title;
    void options;
  });
  const focus = vi.fn(async () => undefined);
  const openWindow = vi.fn(async (url: string) => {
    void url;
    return undefined;
  });
  let windows: { url: string; focus: typeof focus }[] = [];
  const self = {
    location: { origin: "https://app.example" },
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting: vi.fn(),
    registration: { showNotification },
    clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => windows), openWindow },
  };
  const code = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
  vm.runInNewContext(code, { self, URL, console });

  async function dispatch(type: string, extra: Record<string, unknown>) {
    let pending: Promise<unknown> = Promise.resolve();
    handlers[type]({ ...extra, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }
  return {
    handlers,
    showNotification,
    openWindow,
    focus,
    setWindows: (w: typeof windows) => (windows = w),
    push: (data: unknown) =>
      dispatch("push", {
        data:
          data === null
            ? null
            : {
                json: () => (typeof data === "string" ? JSON.parse(data) : data),
                text: () => (typeof data === "string" ? data : JSON.stringify(data)),
              },
      }),
    click: (data: unknown) => dispatch("notificationclick", { notification: { data, close: vi.fn() } }),
  };
}

describe("service worker push handler", () => {
  it("shows the payload's title, body and tag with the app icon and click url", async () => {
    const sw = loadServiceWorker();
    await sw.push({ title: "Don't do this", body: "Paid gig — decline it", tag: "msg-1", url: "/" });
    expect(sw.showNotification).toHaveBeenCalledWith("Don't do this", {
      body: "Paid gig — decline it",
      tag: "msg-1",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/" },
    });
  });

  it("still shows a notification for an empty or non-JSON push (userVisibleOnly)", async () => {
    const sw = loadServiceWorker();
    await sw.push(null);
    await sw.push("plain text message");
    expect(sw.showNotification).toHaveBeenCalledTimes(2);
    const [title1, opts1] = sw.showNotification.mock.calls[0];
    expect(title1).toBe("Good Foreigner");
    expect(opts1?.data).toEqual({ url: "/" });
    const [, opts2] = sw.showNotification.mock.calls[1];
    expect(opts2?.body).toBe("plain text message");
  });

  it("only keeps same-origin paths as the click url", async () => {
    const sw = loadServiceWorker();
    await sw.push({ title: "t", body: "b", url: "https://evil.example/phish" });
    await sw.push({ title: "t", body: "b", url: "//evil.example" });
    await sw.push({ title: "t", body: "b", url: "/?alert=1" });
    const urls = sw.showNotification.mock.calls.map((c) => (c[1]?.data as { url: string }).url);
    expect(urls).toEqual(["/", "/", "/?alert=1"]);
  });
});

describe("service worker notificationclick", () => {
  it("focuses an open window of the app", async () => {
    const sw = loadServiceWorker();
    sw.setWindows([{ url: "https://app.example/", focus: sw.focus }]);
    await sw.click({ url: "/" });
    expect(sw.focus).toHaveBeenCalled();
    expect(sw.openWindow).not.toHaveBeenCalled();
  });

  it("opens the app when no window is open", async () => {
    const sw = loadServiceWorker();
    await sw.click({ url: "/" });
    expect(sw.openWindow).toHaveBeenCalledWith("https://app.example/");
  });
});
