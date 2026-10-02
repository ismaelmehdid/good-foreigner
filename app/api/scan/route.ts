import type { ApiError, InboxItem, ScanResponse } from "@/lib/types";
import { parseProfile, parseToday, runPipeline } from "@/lib/analysis/pipeline";
import { SAMPLE_INBOX } from "@/lib/sample/inbox";
import { fetchInbox, GmailAuthError } from "@/lib/gmail/fetchInbox";

export const runtime = "nodejs";

const MAX_SKIP_IDS = 300;

/** Ids the client already analyzed: strings only, capped so the request stays small. */
function parseSkipIds(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, MAX_SKIP_IDS));
}

function error(status: number, message: string) {
  return Response.json({ error: message } satisfies ApiError, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_json");
  }
  const { profile: rawProfile, demo, today: rawToday, skipIds: rawSkipIds } = (body ?? {}) as {
    profile?: unknown;
    demo?: unknown;
    today?: unknown;
    skipIds?: unknown;
  };

  const profile = parseProfile(rawProfile);
  if (!profile) return error(400, "invalid_profile");
  const today = parseToday(rawToday);

  let items: InboxItem[];
  if (demo === true) {
    items = SAMPLE_INBOX;
  } else {
    const auth = request.headers.get("authorization") ?? "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) return error(401, "gmail_unauthorized");
    try {
      items = await fetchInbox(match[1].trim(), undefined, parseSkipIds(rawSkipIds));
    } catch (err) {
      if (err instanceof GmailAuthError) {
        if (err.status === 403) {
          console.error("[api/scan] gmail forbidden:", err.message);
          return error(403, "gmail_forbidden");
        }
        return error(401, "gmail_unauthorized");
      }
      console.error("[api/scan] gmail fetch failed:", (err as Error).message);
      return error(500, "gmail_fetch_failed");
    }
  }

  // Nothing new since the client's last poll: answer without any model calls.
  if (items.length === 0) return Response.json({ alerts: [], scanned: 0 } satisfies ScanResponse);

  try {
    const alerts = await runPipeline(items, profile, { today });
    return Response.json({ alerts, scanned: items.length } satisfies ScanResponse);
  } catch (err) {
    console.error("[api/scan] pipeline failed:", (err as Error).message);
    return error(500, "scan_failed");
  }
}
