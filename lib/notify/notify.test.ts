import { describe, it, expect, vi, afterEach } from "vitest";
import type { Alert, RiskLevel } from "@/lib/types";
import {
  needsHomeScreenInstall,
  notificationPermission,
  notificationsSupported,
  notifyAlerts,
  sendTestNotification,
} from "./notify";

function alert(id: string, risk: RiskLevel, title = `Title ${id}`, instead = `Do ${id} instead`): Alert {
  return {
    item: { id, source: "email", subject: `Subject ${id}`, body: "..." },
    triage: { relevant: true, category: "employment", reason: "" },
    verdict:
      risk === "unknown"
        ? null
        : { risk, title, explanation: "", ruleIds: [], whatToDoInstead: instead },
    risk,
    citations: [],
  };
}

interface Shown {
  title: string;
  options?: NotificationOptions;
}

function setup({
  permission = "granted" as NotificationPermission,
  serviceWorker = true,
  userAgent = "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile",
  standalone = false,
} = {}) {
  const shown: Shown[] = [];
  const constructed: Shown[] = [];
  const showNotification = vi.fn(async (title: string, options?: NotificationOptions) => {
    shown.push({ title, options });
  });
  class FakeNotification {
    static permission: NotificationPermission = permission;
    static requestPermission = vi.fn(async () => FakeNotification.permission);
    onclick: (() => void) | null = null;
    constructor(title: string, options?: NotificationOptions) {
      constructed.push({ title, options });
    }
    close() {}
  }
  vi.stubGlobal("window", {
    Notification: FakeNotification,
    matchMedia: (q: string) => ({ matches: standalone && q.includes("standalone") }),
    focus: () => {},
  });
  vi.stubGlobal("navigator", {
    userAgent,
    maxTouchPoints: 5,
    platform: "",
    ...(serviceWorker ? { serviceWorker: { ready: Promise.resolve({ showNotification }) } } : {}),
  });
  return { shown, constructed, showNotification, FakeNotification };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("support and permission", () => {
  it("reports unsupported without a window", () => {
    expect(notificationsSupported()).toBe(false);
    expect(notificationPermission()).toBe("unsupported");
  });

  it("reads Notification.permission when supported", () => {
    setup({ permission: "denied" });
    expect(notificationsSupported()).toBe(true);
    expect(notificationPermission()).toBe("denied");
  });
});

describe("notifyAlerts", () => {
  it("notifies only critical/high/medium with plain titles, tag, icon and click url", async () => {
    const { shown } = setup();
    const count = await notifyAlerts([
      alert("c", "critical", "Paid work is not allowed", "Decline or do it after you leave the US"),
      alert("h", "high"),
      alert("m", "medium"),
      alert("l", "low"),
      alert("n", "none"),
      alert("u", "unknown"),
    ]);

    expect(count).toBe(3);
    expect(shown.map((s) => [s.title, s.options?.tag])).toEqual([
      ["Don't do this", "c"],
      ["Don't do this", "h"],
      ["Be careful", "m"],
    ]);
    expect(shown[0].options?.body).toBe("Paid work is not allowed — Decline or do it after you leave the US");
    expect(shown[0].options?.icon).toBe("/icon-192.png");
    expect(shown[0].options?.data).toEqual({ url: "/" });
  });

  it("cuts the body to 120 characters", async () => {
    const { shown } = setup();
    await notifyAlerts([alert("long", "high", "A".repeat(80), "B".repeat(80))]);
    const body = shown[0].options?.body ?? "";
    expect(body.length).toBe(120);
    expect(body.endsWith("…")).toBe(true);
  });

  it("shows nothing when permission is not granted", async () => {
    const { showNotification } = setup({ permission: "default" });
    expect(await notifyAlerts([alert("c", "critical")])).toBe(0);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it("falls back to new Notification without a service worker", async () => {
    const { constructed } = setup({ serviceWorker: false });
    expect(await notifyAlerts([alert("m", "medium")])).toBe(1);
    expect(constructed[0].title).toBe("Be careful");
    expect(constructed[0].options?.tag).toBe("m");
  });

  it("returns 0 for an empty list", async () => {
    setup();
    expect(await notifyAlerts([])).toBe(0);
  });
});

describe("sendTestNotification", () => {
  it("shows the watching message when permission is granted", async () => {
    const { shown } = setup();
    expect(await sendTestNotification()).toBe(true);
    expect(shown[0].title).toBe("Good Foreigner is watching your inbox");
  });

  it("returns false when permission is denied", async () => {
    const { showNotification } = setup({ permission: "denied" });
    expect(await sendTestNotification()).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe("needsHomeScreenInstall", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";

  it("is true on iPhone Safari outside the home-screen app", () => {
    setup({ userAgent: IPHONE });
    expect(needsHomeScreenInstall()).toBe(true);
  });

  it("is false on iPhone when running standalone", () => {
    setup({ userAgent: IPHONE, standalone: true });
    expect(needsHomeScreenInstall()).toBe(false);
  });

  it("is false on Android", () => {
    setup();
    expect(needsHomeScreenInstall()).toBe(false);
  });
});
