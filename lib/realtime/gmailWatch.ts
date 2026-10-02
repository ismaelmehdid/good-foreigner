// Server-only: Gmail push (users.watch / users.stop) and history.list. Tokens are never logged.
import { GmailAuthError } from "@/lib/gmail/fetchInbox";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_HISTORY_PAGES = 10;

async function gmail<T>(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new GmailAuthError(res.status);
  if (!res.ok) {
    const err = new Error(`Gmail ${path.split("?")[0]} failed with status ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export interface WatchResult {
  historyId: string;
  /** ms epoch */
  expiration: number;
}

/** Start (or renew) Gmail push for INBOX to the Pub/Sub topic. */
export async function watch(accessToken: string, topicName = process.env.PUBSUB_TOPIC ?? ""): Promise<WatchResult> {
  if (!topicName) throw new Error("PUBSUB_TOPIC not set");
  const r = await gmail<{ historyId?: string; expiration?: string }>("/watch", accessToken, {
    method: "POST",
    body: { topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" },
  });
  if (!r.historyId) throw new Error("Gmail watch returned no historyId");
  return { historyId: String(r.historyId), expiration: Number(r.expiration ?? 0) };
}

/** Stop Gmail push for this mailbox. */
export async function stop(accessToken: string): Promise<void> {
  await gmail("/stop", accessToken, { method: "POST", body: {} });
}

/** Mailbox address (fallback when the code exchange returned no id_token email). */
export async function getProfileEmail(accessToken: string): Promise<string> {
  const r = await gmail<{ emailAddress?: string }>("/profile", accessToken);
  if (!r.emailAddress) throw new Error("Gmail profile returned no emailAddress");
  return r.emailAddress.toLowerCase();
}

export interface NewMessages {
  /** New INBOX message ids, oldest first, de-duplicated. */
  ids: string[];
  /** Latest mailbox historyId reported by Gmail (store it), or null. */
  historyId: string | null;
  /** True when startHistoryId is too old (404): caller should reset from a fresh watch. */
  reset: boolean;
}

interface HistoryResponse {
  history?: { messagesAdded?: { message?: { id?: string; labelIds?: string[] } }[] }[];
  historyId?: string;
  nextPageToken?: string;
}

/** users.history.list since startHistoryId (messageAdded, INBOX), following pagination. */
export async function listNewMessageIds(accessToken: string, startHistoryId: string): Promise<NewMessages> {
  const ids: string[] = [];
  const seen = new Set<string>();
  let historyId: string | null = null;
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const q = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", labelId: "INBOX" });
    if (pageToken) q.set("pageToken", pageToken);
    let r: HistoryResponse;
    try {
      r = await gmail<HistoryResponse>(`/history?${q.toString()}`, accessToken);
    } catch (err) {
      if ((err as { status?: number }).status === 404) return { ids: [], historyId: null, reset: true };
      throw err;
    }
    if (r.historyId) historyId = String(r.historyId);
    for (const h of r.history ?? []) {
      for (const added of h.messagesAdded ?? []) {
        const id = added.message?.id;
        const labels = added.message?.labelIds;
        if (!id || seen.has(id) || (labels && !labels.includes("INBOX"))) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return { ids, historyId, reset: false };
}
