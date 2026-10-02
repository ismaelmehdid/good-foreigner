import type { ApiError, CheckResponse, InboxItem } from "@/lib/types";
import { parseProfile, runPipeline } from "@/lib/analysis/pipeline";

export const runtime = "nodejs";

const MAX_TEXT_CHARS = 4_000;

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
  const { text, profile: rawProfile } = (body ?? {}) as { text?: unknown; profile?: unknown };

  if (typeof text !== "string" || text.trim() === "") return error(400, "text_required");
  const profile = parseProfile(rawProfile);
  if (!profile) return error(400, "invalid_profile");

  const item: InboxItem = {
    id: `action-${crypto.randomUUID()}`,
    source: "action",
    date: new Date().toISOString(),
    body: text.trim().slice(0, MAX_TEXT_CHARS),
  };

  try {
    const [alert] = await runPipeline([item], profile);
    return Response.json({ alert } satisfies CheckResponse);
  } catch (err) {
    console.error("[api/check] failed:", (err as Error).message);
    return error(500, "check_failed");
  }
}
