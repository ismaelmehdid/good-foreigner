import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exchangeCode, refreshAccessToken, emailFromIdToken, OAuthError } from "./googleOAuth";

const CLIENT = "client-123.apps.googleusercontent.com";
const idToken = (claims: object) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "shh");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("exchangeCode", () => {
  it("POSTs the code with redirect_uri=postmessage and returns tokens + email from id_token", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        access_token: "at",
        refresh_token: "rt",
        id_token: idToken({ aud: CLIENT, email: "User@Example.com", email_verified: true }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await exchangeCode("4/abc")).toEqual({ refreshToken: "rt", accessToken: "at", email: "user@example.com" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const params = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(params)).toEqual({
      client_id: CLIENT,
      client_secret: "shh",
      code: "4/abc",
      grant_type: "authorization_code",
      redirect_uri: "postmessage",
    });
  });

  it("returns refreshToken null when Google sends none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ access_token: "at" })));
    expect((await exchangeCode("c")).refreshToken).toBeNull();
  });

  it("throws OAuthError on invalid_grant", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_grant" }, 400)));
    await expect(exchangeCode("bad")).rejects.toMatchObject({ name: "OAuthError", status: 400, code: "invalid_grant" });
  });
});

describe("refreshAccessToken", () => {
  it("uses grant_type=refresh_token and returns the access token", async () => {
    const fetchMock = vi.fn(async () => json({ access_token: "fresh" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await refreshAccessToken("rt")).toBe("fresh");
    const params = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("rt");
  });

  it("throws OAuthError when revoked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_grant" }, 400)));
    await expect(refreshAccessToken("rt")).rejects.toBeInstanceOf(OAuthError);
  });
});

describe("emailFromIdToken", () => {
  it("rejects a token for another audience or an unverified email", () => {
    expect(emailFromIdToken(idToken({ aud: "other", email: "a@b.c" }), CLIENT)).toBeNull();
    expect(emailFromIdToken(idToken({ aud: CLIENT, email: "a@b.c", email_verified: false }), CLIENT)).toBeNull();
    expect(emailFromIdToken("garbage", CLIENT)).toBeNull();
    expect(emailFromIdToken(undefined, CLIENT)).toBeNull();
  });
});
