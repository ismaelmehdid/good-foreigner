import type { ApiError, InboxItem, ScanResponse } from "@/lib/types";
import { parseProfile, runPipeline } from "@/lib/analysis/pipeline";
import { SAMPLE_INBOX } from "@/lib/sample/inbox";
import { fetchInbox, GmailAuthError } from "@/lib/gmail/fetchInbox";

export const runtime = "nodejs";

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
  const { profile: rawProfile, demo } = (body ?? {}) as { profile?: unknown; demo?: unknown };

  const profile = parseProfile(rawProfile);
  if (!profile) return error(400, "invalid_profile");

  let items: InboxItem[];
  if (demo === true) {
    items = SAMPLE_INBOX;
  } else {
    const auth = request.headers.get("authorization") ?? "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) return error(401, "gmail_unauthorized");
    try {
      items = await fetchInbox(match[1].trim());
    } catch (err) {
      if (err instanceof GmailAuthError) return error(401, "gmail_unauthorized");
      console.error("[api/scan] gmail fetch failed:", (err as Error).message);
      return error(500, "gmail_fetch_failed");
    }
  }

  try {
    const alerts = await runPipeline(items, profile);
    return Response.json({ alerts, scanned: items.length } satisfies ScanResponse);
  } catch (err) {
    console.error("[api/scan] pipeline failed:", (err as Error).message);
    return error(500, "scan_failed");
  }
}
