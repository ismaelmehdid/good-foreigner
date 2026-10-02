import { describe, it, expect } from "vitest";
import { sameKey, urlBase64ToUint8Array } from "./pushUtils";

describe("urlBase64ToUint8Array", () => {
  it("decodes unpadded base64url with - and _", () => {
    // 0xfb 0xff 0xbf -> standard "+/+/" family; base64url uses "-" and "_".
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0x00, 0x01]);
    const b64url = Buffer.from(bytes).toString("base64url"); // unpadded
    expect(b64url).toMatch(/[-_]/);
    expect(Array.from(urlBase64ToUint8Array(b64url))).toEqual(Array.from(bytes));
  });

  it("decodes a 65-byte uncompressed P-256 VAPID public key", () => {
    const raw = new Uint8Array(65).map((_, i) => (i === 0 ? 0x04 : (i * 37) % 256));
    const key = Buffer.from(raw).toString("base64url");
    const out = urlBase64ToUint8Array(key);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(65);
    expect(out[0]).toBe(0x04);
    expect(Array.from(out)).toEqual(Array.from(raw));
  });

  it("tolerates surrounding whitespace and existing padding", () => {
    const padded = Buffer.from("hi!").toString("base64"); // "aGkh"
    expect(Array.from(urlBase64ToUint8Array(` ${padded}\n`))).toEqual([0x68, 0x69, 0x21]);
    expect(Array.from(urlBase64ToUint8Array("aGk="))).toEqual([0x68, 0x69]);
  });

  it("throws on invalid input", () => {
    expect(() => urlBase64ToUint8Array("not base64 !!")).toThrow();
  });
});

describe("sameKey", () => {
  it("compares an ArrayBuffer key with bytes", () => {
    const a = new Uint8Array([1, 2, 3]);
    expect(sameKey(a.buffer, new Uint8Array([1, 2, 3]))).toBe(true);
    expect(sameKey(a.buffer, new Uint8Array([1, 2, 4]))).toBe(false);
    expect(sameKey(null, a)).toBe(false);
  });
});
