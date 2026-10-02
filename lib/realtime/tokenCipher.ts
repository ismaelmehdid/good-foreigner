// AES-256-GCM for Gmail refresh tokens at rest. Format: v1:<iv>:<tag>:<ciphertext> (base64 each).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { encryptionKeyFromEnv } from "./env";

const VERSION = "v1";
const IV_BYTES = 12;

function keyOrThrow(key?: Buffer): Buffer {
  const k = key ?? encryptionKeyFromEnv();
  if (!k || k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}

export function encryptToken(plain: string, key?: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyOrThrow(key), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/** Throws on wrong key, tampering or a malformed value (never includes the value in the error). */
export function decryptToken(enc: string, key?: Buffer): string {
  const parts = enc.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("decryptToken: unsupported format");
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== 16) throw new Error("decryptToken: malformed value");
  const decipher = createDecipheriv("aes-256-gcm", keyOrThrow(key), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("decryptToken: authentication failed");
  }
}
