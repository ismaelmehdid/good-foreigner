// Server-only: real-time alert configuration. Values are read at call time (never cached),
// and secrets are never logged — only the NAMES of missing variables.

export interface RealtimeEnv {
  clientId: string;
  clientSecret: string;
  project: string;
  topic: string;
  pushToken: string;
  encryptionKey: Buffer; // 32 bytes (AES-256)
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

const REQUIRED = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CLOUD_PROJECT",
  "PUBSUB_TOPIC",
  "PUSH_VERIFICATION_TOKEN",
  "TOKEN_ENCRYPTION_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
] as const;

const val = (name: string) => (process.env[name] ?? "").trim();

/** Decode TOKEN_ENCRYPTION_KEY (base64). Returns null unless it is exactly 32 bytes. */
export function encryptionKeyFromEnv(): Buffer | null {
  const raw = val("TOKEN_ENCRYPTION_KEY");
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

/** Names of missing/invalid variables (plus REALTIME_ENABLED when it is not "true"). */
export function realtimeEnvProblems(): string[] {
  const problems: string[] = REQUIRED.filter((n) => !val(n));
  if (val("TOKEN_ENCRYPTION_KEY") && !encryptionKeyFromEnv()) problems.push("TOKEN_ENCRYPTION_KEY (must be 32 bytes, base64)");
  if (val("PUSH_VERIFICATION_TOKEN") && val("PUSH_VERIFICATION_TOKEN").length < 32) {
    problems.push("PUSH_VERIFICATION_TOKEN (must be 32+ chars)");
  }
  if (val("REALTIME_ENABLED") !== "true") problems.push("REALTIME_ENABLED");
  return problems;
}

/** Full validated config, or null when the feature is off or misconfigured. */
export function realtimeEnv(): RealtimeEnv | null {
  if (realtimeEnvProblems().length > 0) return null;
  return {
    clientId: val("GOOGLE_CLIENT_ID"),
    clientSecret: val("GOOGLE_CLIENT_SECRET"),
    project: val("GOOGLE_CLOUD_PROJECT"),
    topic: val("PUBSUB_TOPIC"),
    pushToken: val("PUSH_VERIFICATION_TOKEN"),
    encryptionKey: encryptionKeyFromEnv()!,
    vapidPublicKey: val("VAPID_PUBLIC_KEY"),
    vapidPrivateKey: val("VAPID_PRIVATE_KEY"),
    vapidSubject: val("VAPID_SUBJECT"),
  };
}

export function realtimeEnabled(): boolean {
  return realtimeEnv() !== null;
}
