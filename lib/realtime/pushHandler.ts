// Server-only: processes one Gmail Pub/Sub notification end to end. Never logs tokens or bodies.
import { createHash, timingSafeEqual } from "node:crypto";
import { runPipeline } from "@/lib/analysis/pipeline";
import { fetchMessages } from "@/lib/gmail/fetchInbox";
import { refreshAccessToken } from "./googleOAuth";
import { listNewMessageIds, watch } from "./gmailWatch";
import { decryptToken } from "./tokenCipher";
import { getUser, markProcessed, removeSubscription, upsertUser } from "./store";
import { PUSH_RISKS, sendAlertPush } from "./webPush";

export const MAX_MESSAGES_PER_PUSH = 10;
export const PUSH_PIPELINE_DEADLINE_MS = 60_000;

/** Constant-time comparison of the ?token= query param against PUSH_VERIFICATION_TOKEN. */
export function verifyPushToken(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's date (YYYY-MM-DD) in an IANA timezone; UTC when the zone is invalid. */
export function todayInTimezone(tz: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

/** Decode a Pub/Sub push body `{ message: { data: base64(JSON) } }`; null when malformed. */
export function decodePubSubPush(body: unknown): GmailNotification | null {
  const data = (body as { message?: { data?: unknown } })?.message?.data;
  if (typeof data !== "string" || !data) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as {
      emailAddress?: unknown;
      historyId?: unknown;
    };
    if (typeof parsed.emailAddress !== "string" || !parsed.emailAddress) return null;
    if (typeof parsed.historyId !== "string" && typeof parsed.historyId !== "number") return null;
    return { emailAddress: parsed.emailAddress.toLowerCase(), historyId: String(parsed.historyId) };
  } catch {
    return null;
  }
}

export type PushOutcome =
  | "unknown_user"
  | "no_subscriptions"
  | "auth_failed"
  | "history_reset"
  | "nothing_new"
  | "processed";

export interface PushReport {
  outcome: PushOutcome;
  analyzed: number;
  pushed: number;
  removedSubscriptions: number;
}

const report = (outcome: PushOutcome, extra: Partial<PushReport> = {}): PushReport => ({
  outcome,
  analyzed: 0,
  pushed: 0,
  removedSubscriptions: 0,
  ...extra,
});

/**
 * Handle one Gmail notification: refresh the user's access token, list INBOX messages added
 * since the stored historyId, skip already-processed ids, analyze up to 10 new messages, Web Push
 * critical/high/medium alerts, then store the new historyId + processed ids. If anything throws
 * before the historyId is stored, the next notification picks the same messages up again.
 */
export async function handleGmailNotification(n: GmailNotification, topic: string): Promise<PushReport> {
  const user = await getUser(n.emailAddress);
  if (!user) return report("unknown_user");
  if (!user.subscriptions?.length) return report("no_subscriptions");

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decryptToken(user.refreshTokenEnc));
  } catch (err) {
    console.error("[gmail/push] token refresh failed:", (err as Error).name);
    return report("auth_failed");
  }

  if (!user.historyId) {
    await upsertUser(user.email, { historyId: n.historyId });
    return report("nothing_new");
  }

  const listed = await listNewMessageIds(accessToken, user.historyId);
  if (listed.reset) {
    const w = await watch(accessToken, topic);
    await upsertUser(user.email, { historyId: w.historyId, watchExpiration: w.expiration });
    return report("history_reset");
  }

  const processed = new Set(user.processedIds ?? []);
  const fresh = listed.ids.filter((id) => !processed.has(id));
  const newHistoryId = listed.historyId ?? n.historyId;
  if (fresh.length === 0) {
    await markProcessed(user.email, [], newHistoryId);
    return report("nothing_new");
  }

  const items = await fetchMessages(accessToken, fresh.slice(-MAX_MESSAGES_PER_PUSH));
  const alerts = await runPipeline(items, user.profile, {
    today: todayInTimezone(user.timezone),
    deadlineMs: PUSH_PIPELINE_DEADLINE_MS,
  });

  const gone = new Set<string>();
  let pushed = 0;
  for (const alert of alerts.filter((a) => PUSH_RISKS.has(a.risk))) {
    for (const sub of user.subscriptions) {
      if (!sub.endpoint || gone.has(sub.endpoint)) continue;
      const result = await sendAlertPush(sub, alert);
      if (result === "sent") pushed++;
      else if (result === "gone") gone.add(sub.endpoint);
    }
  }

  await markProcessed(user.email, fresh, newHistoryId);
  for (const endpoint of gone) await removeSubscription(user.email, endpoint);
  return report("processed", { analyzed: items.length, pushed, removedSubscriptions: gone.size });
}
