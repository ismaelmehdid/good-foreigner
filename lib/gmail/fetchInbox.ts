// Server-only: reads the user's recent Gmail messages with a short-lived OAuth token.
// Plain fetch against the Gmail REST API. Nothing here is persisted.
import type { InboxItem } from "@/lib/types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailAuthError extends Error {
  readonly status: number;
  constructor(status: number, message = "Gmail authorization failed") {
    super(message);
    this.name = "GmailAuthError";
    this.status = status;
  }
}

interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPayload {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPayload[];
}

interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: GmailPayload;
}

interface GmailListResponse {
  messages?: { id: string; threadId?: string }[];
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => safeFromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => safeFromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/gi, "&");
}

function safeFromCodePoint(n: number): string {
  try {
    return String.fromCodePoint(n);
  } catch {
    return " ";
  }
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped);
}

/** First non-empty decoded body with the given mime type, depth-first, skipping attachments. */
function findBody(payload: GmailPayload, mimeType: string): string | null {
  if (!payload.filename && payload.mimeType?.toLowerCase() === mimeType && payload.body?.data) {
    const text = decodeBase64Url(payload.body.data);
    if (text.trim()) return text;
  }
  for (const part of payload.parts ?? []) {
    const found = findBody(part, mimeType);
    if (found) return found;
  }
  return null;
}

export function extractPlainText(payload: GmailPayload): string {
  const plain = findBody(payload, "text/plain");
  if (plain) return collapseWhitespace(plain);
  const html = findBody(payload, "text/html");
  if (html) return collapseWhitespace(htmlToText(html));
  return "";
}

function header(payload: GmailPayload | undefined, name: string): string | undefined {
  const lower = name.toLowerCase();
  return payload?.headers?.find((h) => h.name.toLowerCase() === lower)?.value;
}

async function gmailGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new GmailAuthError(res.status);
  if (!res.ok) throw new Error(`Gmail API request failed with status ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchInbox(token: string, max = 15): Promise<InboxItem[]> {
  const list = await gmailGet<GmailListResponse>(
    `${GMAIL_API}/messages?maxResults=${max}&q=newer_than:30d`,
    token,
  );
  const ids = (list.messages ?? []).map((m) => m.id);

  const messages = await Promise.all(
    ids.map((id) => gmailGet<GmailMessage>(`${GMAIL_API}/messages/${encodeURIComponent(id)}?format=full`, token)),
  );

  return messages.map((msg) => ({
    id: msg.id,
    source: "email" as const,
    from: header(msg.payload, "From"),
    subject: header(msg.payload, "Subject"),
    date: header(msg.payload, "Date"),
    body: (msg.payload ? extractPlainText(msg.payload) : "") || msg.snippet || "",
  }));
}
