import { parseProfile } from "@/lib/analysis/pipeline";
import { realtimeEnv } from "@/lib/realtime/env";
import { exchangeCode } from "@/lib/realtime/googleOAuth";
import { getProfileEmail, watch } from "@/lib/realtime/gmailWatch";
import { isValidTimezone } from "@/lib/realtime/pushHandler";
import { addSubscription, getUser, upsertUser } from "@/lib/realtime/store";
import { encryptToken } from "@/lib/realtime/tokenCipher";
import { parseSubscription } from "@/lib/realtime/webPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const env = realtimeEnv();
  if (!env) return error(503, "realtime_disabled");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return error(400, "invalid_request");
  }
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const profile = parseProfile(body?.profile);
  const subscription = parseSubscription(body?.subscription);
  if (!code || code.length > 2048 || !profile || !subscription || !isValidTimezone(body?.timezone)) {
    return error(400, "invalid_request");
  }
  const timezone = body.timezone as string;

  let tokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    tokens = await exchangeCode(code);
  } catch (err) {
    console.error("[realtime/enable] code exchange failed:", (err as Error).message);
    return error(401, "code_exchange_failed");
  }
  try {
    const email = tokens.email ?? (await getProfileEmail(tokens.accessToken));
    // Google omits the refresh token when the user already consented before; on re-enable,
    // keep the one we stored for this email. No refresh token at all → 401 per contract.
    let refreshTokenEnc: string;
    if (tokens.refreshToken) {
      refreshTokenEnc = encryptToken(tokens.refreshToken, env.encryptionKey);
    } else {
      const existing = await getUser(email);
      if (!existing?.refreshTokenEnc) {
        console.error("[realtime/enable] no refresh token returned and none stored (needs first-time consent)");
        return error(401, "code_exchange_failed");
      }
      refreshTokenEnc = existing.refreshTokenEnc;
    }
    const w = await watch(tokens.accessToken, env.topic);
    await upsertUser(email, {
      refreshTokenEnc,
      profile,
      timezone,
      historyId: w.historyId,
      watchExpiration: w.expiration,
    });
    await addSubscription(email, subscription);
    return Response.json({ enabled: true, email, expiration: w.expiration });
  } catch (err) {
    console.error("[realtime/enable] failed:", (err as Error).name, (err as Error).message.slice(0, 200));
    return error(500, "enable_failed");
  }
}
