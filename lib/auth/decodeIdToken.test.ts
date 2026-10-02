import { describe, it, expect } from "vitest";
import { decodeIdToken } from "./decodeIdToken";

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jwt(payload: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.fake-signature`;
}

describe("decodeIdToken", () => {
  it("decodes email, name and picture from a valid payload", () => {
    const user = decodeIdToken(
      jwt({
        iss: "https://accounts.google.com",
        sub: "1234",
        email: "ada@example.com",
        email_verified: true,
        name: "Ada Lovelace",
        picture: "https://lh3.googleusercontent.com/a/abc",
      }),
    );
    expect(user).toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
      picture: "https://lh3.googleusercontent.com/a/abc",
    });
  });

  it("throws when the payload has no email", () => {
    expect(() => decodeIdToken(jwt({ sub: "1234", name: "No Email" }))).toThrow(/email/i);
  });

  it("throws on a malformed token", () => {
    expect(() => decodeIdToken("not-a-jwt")).toThrow();
  });

  it("decodes UTF-8 names correctly", () => {
    const user = decodeIdToken(jwt({ email: "jose@example.com", name: "José Müller", given_name: "José" }));
    expect(user.name).toBe("José Müller");
    expect(user.picture).toBeUndefined();
  });

  it("falls back to the email when the name is missing", () => {
    expect(decodeIdToken(jwt({ email: "solo@example.com" })).name).toBe("solo@example.com");
  });
});
