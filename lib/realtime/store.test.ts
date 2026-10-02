import { describe, it, expect, beforeEach } from "vitest";
import {
  __setDbForTests,
  addSubscription,
  deleteUser,
  dropSubscription,
  findUserByEndpoint,
  getUser,
  markProcessed,
  mergeProcessed,
  mergeSubscription,
  removeSubscription,
  upsertUser,
} from "./store";

/** Minimal in-memory Firestore: collection/doc/get/set/delete, where array-contains, transactions. */
function fakeFirestore() {
  const docs = new Map<string, unknown>();
  const ref = (id: string) => ({
    id,
    get: async () => ({ exists: docs.has(id), data: () => structuredClone(docs.get(id)) }),
    set: async (d: unknown) => void docs.set(id, structuredClone(d)),
    delete: async () => void docs.delete(id),
  });
  type Ref = ReturnType<typeof ref>;
  const collection = () => ({
    doc: ref,
    where: (field: string, _op: string, value: unknown) => ({
      limit: () => ({
        get: async () => {
          const hits = [...docs.values()].filter((d) => ((d as Record<string, unknown[]>)[field] ?? []).includes(value));
          return { empty: hits.length === 0, docs: hits.map((d) => ({ data: () => structuredClone(d) })) };
        },
      }),
    }),
  });
  return {
    docs,
    collection,
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
      fn({ get: (r: Ref) => r.get(), set: (r: Ref, d: unknown) => r.set(d), delete: (r: Ref) => r.delete() }),
  };
}

const sub = (endpoint: string, auth = "a"): PushSubscriptionJSON => ({ endpoint, keys: { p256dh: "p", auth } });
let fake: ReturnType<typeof fakeFirestore>;

beforeEach(() => {
  fake = fakeFirestore();
  __setDbForTests(fake);
});

describe("pure helpers", () => {
  it("mergeSubscription dedupes by endpoint (latest keys win)", () => {
    expect(mergeSubscription([sub("e1"), sub("e2")], sub("e1", "new"))).toEqual([sub("e2"), sub("e1", "new")]);
    expect(dropSubscription([sub("e1"), sub("e2")], "e1")).toEqual([sub("e2")]);
  });

  it("mergeProcessed dedupes and keeps the last 200", () => {
    const existing = Array.from({ length: 199 }, (_, i) => `m${i}`);
    const out = mergeProcessed(existing, ["m5", "n1", "n2"]);
    expect(out.length).toBe(200);
    expect(out.at(-1)).toBe("n2");
    expect(out[0]).toBe("m1");
  });
});

describe("store with fake Firestore", () => {
  it("upserts by lowercased email, tracks endpoints, and finds a user by endpoint", async () => {
    await upsertUser("Me@Example.com", { refreshTokenEnc: "v1:x", timezone: "America/Los_Angeles", historyId: "10" });
    await addSubscription("me@example.com", sub("https://push/1"));
    await addSubscription("me@example.com", sub("https://push/1", "rotated"));
    await addSubscription("me@example.com", sub("https://push/2"));
    const u = (await getUser("ME@example.com"))!;
    expect(u.email).toBe("me@example.com");
    expect(u.subscriptions).toHaveLength(2);
    expect(u.endpoints).toEqual(["https://push/1", "https://push/2"]);
    expect(u.updatedAt).toBeGreaterThan(0);
    expect((await findUserByEndpoint("https://push/2"))!.email).toBe("me@example.com");
    expect(await findUserByEndpoint("https://push/none")).toBeNull();
  });

  it("removeSubscription updates endpoints; markProcessed stores ids + historyId; deleteUser removes", async () => {
    await addSubscription("u@x.com", sub("https://push/1"));
    const after = await removeSubscription("u@x.com", "https://push/1");
    expect(after!.subscriptions).toEqual([]);
    expect(after!.endpoints).toEqual([]);
    await markProcessed("u@x.com", ["a", "b"], "99");
    const u = (await getUser("u@x.com"))!;
    expect(u.processedIds).toEqual(["a", "b"]);
    expect(u.historyId).toBe("99");
    await deleteUser("u@x.com");
    expect(await getUser("u@x.com")).toBeNull();
    expect(await removeSubscription("u@x.com", "e")).toBeNull();
  });
});
