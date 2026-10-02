import { refreshAccessToken } from "@/lib/realtime/googleOAuth";
import { stop } from "@/lib/realtime/gmailWatch";
import { deleteUser, findUserByEndpoint, removeSubscription } from "@/lib/realtime/store";
import { decryptToken } from "@/lib/realtime/tokenCipher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
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
    if (!user) return Response.json({ enabled: false });
    const updated = await removeSubscription(user.email, endpoint);
    if (updated && updated.subscriptions.length === 0) {
      try {
        await stop(await refreshAccessToken(decryptToken(updated.refreshTokenEnc)));
      } catch (err) {
        // Best effort: the watch expires on its own within ~7 days.
        console.error("[realtime/disable] Gmail stop failed:", (err as Error).name);
      }
      await deleteUser(user.email);
    }
    return Response.json({ enabled: false });
  } catch (err) {
    console.error("[realtime/disable] failed:", (err as Error).name, (err as Error).message.slice(0, 200));
    return error(500, "disable_failed");
  }
}
