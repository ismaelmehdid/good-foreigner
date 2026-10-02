// Server-only: Web Push (VAPID) delivery. Payload text follows lib/notify/notify.ts rules.
import webpush from "web-push";
import type { Alert } from "@/lib/types";

export type PushResult = "sent" | "gone" | "error";

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

const BODY_MAX = 120;
export const PUSH_RISKS = new Set(["critical", "high", "medium"]);

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Same title/body rules as notifyAlerts (lib/notify/notify.ts). */
export function alertPayload(alert: Alert): PushPayload {
  const title = alert.risk === "medium" ? "Be careful" : "Don't do this";
  const v = alert.verdict;
  const text = v
    ? [v.title, v.whatToDoInstead].filter(Boolean).join(" — ")
    : alert.item.subject || "Open Good Foreigner for details";
  return { title, body: truncate(text, BODY_MAX), tag: alert.item.id, url: "/" };
}

export const TEST_PAYLOAD: PushPayload = {
  title: "Good Foreigner real-time alerts are on",
  body: "You'll get a notification here when a new email could put your visa status at risk.",
  tag: "gf-realtime-test",
  url: "/",
};

function toWebPushSubscription(sub: PushSubscriptionJSON): webpush.PushSubscription | null {
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  if (!sub.endpoint || !p256dh || !auth) return null;
  return { endpoint: sub.endpoint, keys: { p256dh, auth } };
}

async function send(sub: PushSubscriptionJSON, payload: PushPayload): Promise<PushResult> {
  const target = toWebPushSubscription(sub);
  if (!target) return "gone";
  const subject = process.env.VAPID_SUBJECT ?? "";
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  if (!subject || !publicKey || !privateKey) return "error";
  try {
    await webpush.sendNotification(target, JSON.stringify(payload), {
      vapidDetails: { subject, publicKey, privateKey },
      TTL: 3600,
      urgency: "high",
      timeout: 10_000,
    });
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error(`[webPush] send failed (status ${status ?? "n/a"})`);
    return "error";
  }
}

export function sendAlertPush(subscription: PushSubscriptionJSON, alert: Alert): Promise<PushResult> {
  return send(subscription, alertPayload(alert));
}

export function sendTestPush(subscription: PushSubscriptionJSON): Promise<PushResult> {
  return send(subscription, TEST_PAYLOAD);
}

/** Validate a PushSubscriptionJSON from a request body (https endpoint + p256dh/auth keys). */
export function parseSubscription(input: unknown): PushSubscriptionJSON | null {
  const s = input as PushSubscriptionJSON | null;
  if (!s || typeof s !== "object" || typeof s.endpoint !== "string") return null;
  if (!/^https:\/\//.test(s.endpoint) || s.endpoint.length > 2048) return null;
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !p256dh || !auth) return null;
  return {
    endpoint: s.endpoint,
    expirationTime: typeof s.expirationTime === "number" ? s.expirationTime : null,
    keys: { p256dh, auth },
  };
}
