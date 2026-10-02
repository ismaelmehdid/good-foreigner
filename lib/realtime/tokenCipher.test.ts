import { describe, it, expect, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken } from "./tokenCipher";

const key = randomBytes(32);
const ORIGINAL = process.env.TOKEN_ENCRYPTION_KEY;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL;
});

describe("tokenCipher", () => {
  it("round-trips and uses the v1:<iv>:<tag>:<ct> base64 format", () => {
    const enc = encryptToken("1//refresh-token", key);
    expect(enc).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(enc).not.toContain("refresh-token");
    expect(decryptToken(enc, key)).toBe("1//refresh-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("rejects tampering and the wrong key", () => {
    const enc = encryptToken("secret", key);
    const [v, iv, tag, ct] = enc.split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 0xff;
    expect(() => decryptToken([v, iv, tag, flipped.toString("base64")].join(":"), key)).toThrow(/authentication failed/);
    expect(() => decryptToken(enc, randomBytes(32))).toThrow(/authentication failed/);
    expect(() => decryptToken("v2:a:b:c", key)).toThrow(/unsupported format/);
  });

  it("reads the key from TOKEN_ENCRYPTION_KEY and refuses a short key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = key.toString("base64");
    expect(decryptToken(encryptToken("from-env"))).toBe("from-env");
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encryptToken("x")).toThrow(/32 bytes/);
  });
});
