// Server-only: Google OAuth code exchange (GIS popup code flow) and refresh. Tokens are never logged.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export class OAuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`Google OAuth error ${status}: ${code}`);
    this.name = "OAuthError";
    this.status = status;
    this.code = code;
  }
}

export interface CodeExchangeResult {
  /** Missing when Google did not issue one (e.g. no prompt=consent / access_type=offline). */
  refreshToken: string | null;
  accessToken: string;
  /** Lowercased email from the id_token, or null when no id_token / email claim came back. */
  email: string | null;
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set");
  return { clientId, clientSecret };
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) throw new OAuthError(res.status, body.error ?? "no_access_token");
  return body;
}

/**
 * Email claim from an id_token received directly from Google's token endpoint over TLS
 * (OIDC Core 3.1.3.7 allows TLS server validation instead of a signature check here).
 * Requires aud === our client id and a verified email.
 */
export function emailFromIdToken(idToken: string | undefined, clientId: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      aud?: string;
      email?: string;
      email_verified?: boolean | string;
    };
    if (payload.aud !== clientId) return null;
    if (payload.email_verified === false || payload.email_verified === "false") return null;
    return typeof payload.email === "string" && payload.email ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Exchange a GIS popup authorization code (redirect_uri "postmessage"). */
export async function exchangeCode(code: string): Promise<CodeExchangeResult> {
  const { clientId, clientSecret } = credentials();
  const body = await postToken({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: "postmessage",
  });
  return {
    refreshToken: body.refresh_token ?? null,
    accessToken: body.access_token!,
    email: emailFromIdToken(body.id_token, clientId),
  };
}

/** New short-lived access token from a stored refresh token. Throws OAuthError (e.g. invalid_grant). */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = credentials();
  const body = await postToken({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return body.access_token!;
}
