import { realtimeEnv } from "@/lib/realtime/env";
import { findUserByEndpoint, removeSubscription } from "@/lib/realtime/store";
import { sendTestPush } from "@/lib/realtime/webPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  if (!realtimeEnv()) return error(503, "realtime_disabled");

  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  } catch {
    return error(400, "invalid_request");
  }
  if (!endpoint) return error(400, "invalid_request");

  try {
    const user = await findUserByEndpoint(endpoint);
    const sub = user?.subscriptions.find((s) => s.endpoint === endpoint);
    if (!user || !sub) return error(404, "not_found");

    const result = await sendTestPush(sub);
    if (result === "sent") return Response.json({ sent: true });
    if (result === "gone") {
      await removeSubscription(user.email, endpoint);
      return error(404, "subscription_gone");
    }
    return error(500, "push_failed");
  } catch (err) {
    console.error("[realtime/test] failed:", (err as Error).name, (err as Error).message.slice(0, 200));
    return error(500, "test_failed");
  }
}
