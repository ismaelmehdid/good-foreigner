export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

function base64UrlToUtf8(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Reads the profile claims from a Google ID token (JWT) for display only.
 *
 * The signature is deliberately NOT verified: this identity is used purely for UI
 * (greeting, avatar, Gmail account hint). The server never receives or trusts it and
 * stores nothing, so it grants no access. Anything security-relevant must verify the
 * token server-side against Google's public keys instead.
 */
export function decodeIdToken(jwt: string): GoogleUser {
  const parts = jwt.split(".");
  if (parts.length < 2 || !parts[1]) throw new Error("Malformed ID token");

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(base64UrlToUtf8(parts[1])) as Record<string, unknown>;
  } catch {
    throw new Error("Malformed ID token payload");
  }

  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email) throw new Error("ID token has no email claim");

  const name = typeof claims.name === "string" && claims.name ? claims.name : email;
  const user: GoogleUser = { email, name };
  if (typeof claims.picture === "string" && claims.picture) user.picture = claims.picture;
  return user;
}
