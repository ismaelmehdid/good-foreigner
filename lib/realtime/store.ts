// Server-only: Firestore `users` collection for real-time alerts. Email bodies are never stored;
// the refresh token is stored encrypted (tokenCipher). Firestore is created lazily.
import type { Firestore } from "@google-cloud/firestore";
import type { Profile } from "@/lib/types";

export const USERS = "users";
export const PROCESSED_CAP = 200;

export interface RealtimeUser {
  email: string;
  refreshTokenEnc: string; // AES-256-GCM, never logged
  profile: Profile;
  timezone: string; // IANA
  historyId: string; // last processed Gmail history id
  watchExpiration: number; // ms epoch
  subscriptions: PushSubscriptionJSON[];
  /** Derived from subscriptions (array-contains lookup for disable/test). */
  endpoints: string[];
  processedIds: string[]; // last 200 Gmail message ids
  updatedAt: number;
}

let db: Firestore | null = null;

async function getDb(): Promise<Firestore> {
  if (!db) {
    const { Firestore } = await import("@google-cloud/firestore");
    db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
  }
  return db;
}

/** Tests inject an in-memory fake. */
export function __setDbForTests(fake: unknown): void {
  db = fake as Firestore | null;
}

export const userId = (email: string) => email.trim().toLowerCase();

// ---- pure helpers (unit-tested) ----

/** Add or replace (same endpoint) a subscription. */
export function mergeSubscription(subs: PushSubscriptionJSON[], sub: PushSubscriptionJSON): PushSubscriptionJSON[] {
  return [...subs.filter((s) => s.endpoint !== sub.endpoint), sub];
}

export function dropSubscription(subs: PushSubscriptionJSON[], endpoint: string): PushSubscriptionJSON[] {
  return subs.filter((s) => s.endpoint !== endpoint);
}

/** Append ids (de-duplicated), keeping only the most recent `cap`. */
export function mergeProcessed(existing: string[], ids: string[], cap = PROCESSED_CAP): string[] {
  const set = new Set(existing);
  const out = [...existing];
  for (const id of ids) {
    if (set.has(id)) continue;
    set.add(id);
    out.push(id);
  }
  return out.slice(-cap);
}

function blankUser(email: string): RealtimeUser {
  return {
    email: userId(email),
    refreshTokenEnc: "",
    profile: { visaType: "VWP", entryDate: "1970-01-01" },
    timezone: "UTC",
    historyId: "",
    watchExpiration: 0,
    subscriptions: [],
    endpoints: [],
    processedIds: [],
    updatedAt: 0,
  };
}

function finalize(u: RealtimeUser): RealtimeUser {
  return { ...u, endpoints: u.subscriptions.map((s) => s.endpoint ?? "").filter(Boolean), updatedAt: Date.now() };
}

/** Read-modify-write one user doc in a transaction. `fn` returning null deletes the doc. */
async function mutate(
  email: string,
  fn: (current: RealtimeUser | null) => RealtimeUser | null,
): Promise<RealtimeUser | null> {
  const store = await getDb();
  const ref = store.collection(USERS).doc(userId(email));
  return store.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data() as RealtimeUser) : null;
    const next = fn(current);
    if (next === null) {
      if (current) tx.delete(ref);
      return null;
    }
    const saved = finalize(next);
    tx.set(ref, saved);
    return saved;
  });
}

// ---- data access ----

export async function getUser(email: string): Promise<RealtimeUser | null> {
  const snap = await (await getDb()).collection(USERS).doc(userId(email)).get();
  return snap.exists ? (snap.data() as RealtimeUser) : null;
}

export async function findUserByEndpoint(endpoint: string): Promise<RealtimeUser | null> {
  const q = await (await getDb()).collection(USERS).where("endpoints", "array-contains", endpoint).limit(1).get();
  return q.empty ? null : (q.docs[0].data() as RealtimeUser);
}

/** Create or merge fields into a user. */
export async function upsertUser(
  email: string,
  fields: Partial<Omit<RealtimeUser, "email" | "endpoints" | "updatedAt">>,
): Promise<RealtimeUser> {
  return (await mutate(email, (cur) => ({ ...(cur ?? blankUser(email)), ...fields, email: userId(email) })))!;
}

export async function addSubscription(email: string, sub: PushSubscriptionJSON): Promise<RealtimeUser> {
  return (await mutate(email, (cur) => {
    const u = cur ?? blankUser(email);
    return { ...u, subscriptions: mergeSubscription(u.subscriptions ?? [], sub) };
  }))!;
}

/** Remove one subscription; returns the updated user (null when the user does not exist). */
export async function removeSubscription(email: string, endpoint: string): Promise<RealtimeUser | null> {
  return mutate(email, (cur) => (cur ? { ...cur, subscriptions: dropSubscription(cur.subscriptions ?? [], endpoint) } : null));
}

/** Record processed message ids (capped) and optionally the new historyId. */
export async function markProcessed(email: string, ids: string[], historyId?: string): Promise<void> {
  await mutate(email, (cur) =>
    cur
      ? {
          ...cur,
          processedIds: mergeProcessed(cur.processedIds ?? [], ids),
          historyId: historyId ?? cur.historyId,
        }
      : null,
  );
}

export async function deleteUser(email: string): Promise<void> {
  await (await getDb()).collection(USERS).doc(userId(email)).delete();
}
