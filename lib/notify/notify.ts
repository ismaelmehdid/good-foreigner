// Local (non-push) notifications for risky emails. Client-safe: every entry point
// guards `typeof window`, so importing this from a server component is harmless.
import type { Alert, RiskLevel } from "@/lib/types";

export const NOTIFICATION_ICON = "/icon-192.png";
const BODY_MAX = 120;
const NOTIFY_RISKS: ReadonlySet<RiskLevel> = new Set(["critical", "high", "medium"]);
const SW_READY_TIMEOUT_MS = 3000;

type PermissionResult = NotificationPermission | "unsupported";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && typeof window.Notification !== "undefined";
}

export function notificationPermission(): PermissionResult {
  return notificationsSupported() ? window.Notification.permission : "unsupported";
}

/** Must be called from a user gesture (tap) on mobile. Never re-prompts once decided. */
export async function requestNotifications(): Promise<PermissionResult> {
  if (!notificationsSupported()) return "unsupported";
  const current = window.Notification.permission;
  if (current !== "default") return current;
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

/**
 * iOS/iPadOS only allows web notifications for apps added to the Home Screen (16.4+).
 * True when on iOS and not running as that installed app.
 */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  const iPadOS = navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || iPadOS;
  if (!isIOS) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function contentFor(alert: Alert): { title: string; body: string } {
  const title = alert.risk === "medium" ? "Be careful" : "Don't do this";
  const v = alert.verdict;
  const text = v
    ? [v.title, v.whatToDoInstead].filter(Boolean).join(" — ")
    : alert.item.subject || "Open Good Foreigner for details";
  return { title, body: truncate(text, BODY_MAX) };
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;
  try {
    // `ready` never settles when no worker is registered, so don't wait forever.
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

async function show(
  reg: ServiceWorkerRegistration | null,
  title: string,
  options: NotificationOptions,
): Promise<boolean> {
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return true;
    } catch {
      // Fall through to the page-level API.
    }
  }
  try {
    // Throws on Android Chrome ("use ServiceWorkerRegistration.showNotification").
    const n = new window.Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Notifies critical/high/medium alerts (one per email, deduped by tag). Returns how many were shown. */
export async function notifyAlerts(alerts: Alert[]): Promise<number> {
  if (notificationPermission() !== "granted") return 0;
  const toShow = alerts.filter((a) => NOTIFY_RISKS.has(a.risk));
  if (toShow.length === 0) return 0;

  const reg = await serviceWorkerRegistration();
  let count = 0;
  for (const alert of toShow) {
    const { title, body } = contentFor(alert);
    const ok = await show(reg, title, {
      body,
      tag: alert.item.id,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      data: { url: "/" },
    });
    if (ok) count++;
  }
  return count;
}

/** Demo helper: asks for permission if needed, then shows a "watching" notification. */
export async function sendTestNotification(): Promise<boolean> {
  const permission = await requestNotifications();
  if (permission !== "granted") return false;
  const reg = await serviceWorkerRegistration();
  return show(reg, "Good Foreigner is watching your inbox", {
    body: "You'll get a notification here when an email could put your visa status at risk.",
    tag: "gf-watching",
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    data: { url: "/" },
  });
}
