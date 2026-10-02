import { realtimeEnv } from "@/lib/realtime/env";
import { decodePubSubPush, handleGmailNotification, verifyPushToken } from "@/lib/realtime/pushHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ack = () => new Response(null, { status: 204 });

/**
 * Pub/Sub push endpoint for Gmail notifications. Always acks (204) after the token check so
 * Pub/Sub never retries forever; the stored historyId only advances after successful
 * processing, so a failed run is picked up by the next notification.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!verifyPushToken(token, process.env.PUSH_VERIFICATION_TOKEN)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const env = realtimeEnv();
  if (!env) return ack();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ack();
  }
  const notification = decodePubSubPush(body);
  if (!notification) return ack();

  try {
    const r = await handleGmailNotification(notification, env.topic);
    console.log(`[gmail/push] ${r.outcome} analyzed=${r.analyzed} pushed=${r.pushed} removed=${r.removedSubscriptions}`);
  } catch (err) {
    console.error("[gmail/push] processing failed:", (err as Error).name, (err as Error).message.slice(0, 200));
  }
  return ack();
}
