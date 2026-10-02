import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Alert, InboxItem } from "@/lib/types";
import type { RealtimeUser } from "./store";

vi.mock("@/lib/analysis/pipeline", () => ({ runPipeline: vi.fn() }));
vi.mock("@/lib/gmail/fetchInbox", () => ({ fetchMessages: vi.fn() }));
vi.mock("./googleOAuth", () => ({ refreshAccessToken: vi.fn(async () => "access") }));
vi.mock("./tokenCipher", () => ({ decryptToken: vi.fn(() => "refresh") }));
vi.mock("./gmailWatch", () => ({ listNewMessageIds: vi.fn(), watch: vi.fn() }));
vi.mock("./store", () => ({
  getUser: vi.fn(),
  markProcessed: vi.fn(),
  removeSubscription: vi.fn(),
  upsertUser: vi.fn(),
}));
vi.mock("./webPush", () => ({ PUSH_RISKS: new Set(["critical", "high", "medium"]), sendAlertPush: vi.fn() }));

import {
  decodePubSubPush,
  handleGmailNotification,
  todayInTimezone,
  verifyPushToken,
  isValidTimezone,
} from "./pushHandler";
import { runPipeline } from "@/lib/analysis/pipeline";
import { fetchMessages } from "@/lib/gmail/fetchInbox";
import { listNewMessageIds, watch } from "./gmailWatch";
import { getUser, markProcessed, removeSubscription, upsertUser } from "./store";
import { sendAlertPush } from "./webPush";

const user = (over: Partial<RealtimeUser> = {}): RealtimeUser => ({
  email: "me@x.com",
  refreshTokenEnc: "v1:enc",
  profile: { visaType: "VWP", entryDate: "2026-08-01" },
  timezone: "America/Los_Angeles",
  historyId: "100",
  watchExpiration: 0,
  subscriptions: [{ endpoint: "https://push/1", keys: { p256dh: "p", auth: "a" } }],
  endpoints: ["https://push/1"],
  processedIds: ["old"],
  updatedAt: 0,
  ...over,
});
const alert = (id: string, risk: Alert["risk"]): Alert => ({
  item: { id, source: "email", body: "" },
  triage: { relevant: true, category: "other", reason: "" },
  verdict: null,
  risk,
  citations: [],
});

beforeEach(() => vi.clearAllMocks());

describe("helpers", () => {
  it("verifyPushToken is exact and rejects missing values", () => {
    expect(verifyPushToken("a".repeat(40), "a".repeat(40))).toBe(true);
    expect(verifyPushToken("a".repeat(39), "a".repeat(40))).toBe(false);
    expect(verifyPushToken(null, "x")).toBe(false);
    expect(verifyPushToken("x", undefined)).toBe(false);
  });

  it("todayInTimezone uses the user's zone", () => {
    const now = new Date("2026-10-03T03:00:00Z"); // still Oct 2 in Los Angeles
    expect(todayInTimezone("America/Los_Angeles", now)).toBe("2026-10-02");
    expect(todayInTimezone("Europe/Paris", now)).toBe("2026-10-03");
    expect(todayInTimezone("Not/AZone", now)).toBe("2026-10-03");
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
  });

  it("decodePubSubPush reads base64 JSON and rejects junk", () => {
    const data = Buffer.from(JSON.stringify({ emailAddress: "Me@X.com", historyId: 123 })).toString("base64");
    expect(decodePubSubPush({ message: { data } })).toEqual({ emailAddress: "me@x.com", historyId: "123" });
    expect(decodePubSubPush({ message: { data: "!!" } })).toBeNull();
    expect(decodePubSubPush({})).toBeNull();
  });
});

describe("handleGmailNotification", () => {
  const n = { emailAddress: "me@x.com", historyId: "200" };

  it("acks unknown users without doing work", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    expect((await handleGmailNotification(n, "topic")).outcome).toBe("unknown_user");
    expect(listNewMessageIds).not.toHaveBeenCalled();
  });

  it("skips processed ids, analyzes new ones, pushes critical/high/medium, drops gone subs, stores state", async () => {
    vi.mocked(getUser).mockResolvedValue(
      user({
        subscriptions: [
          { endpoint: "https://push/1", keys: { p256dh: "p", auth: "a" } },
          { endpoint: "https://push/gone", keys: { p256dh: "p", auth: "a" } },
        ],
      }),
    );
    vi.mocked(listNewMessageIds).mockResolvedValue({ ids: ["old", "m1", "m2"], historyId: "210", reset: false });
    vi.mocked(fetchMessages).mockResolvedValue([{ id: "m1" }, { id: "m2" }] as InboxItem[]);
    vi.mocked(runPipeline).mockResolvedValue([alert("m1", "high"), alert("m2", "low")]);
    vi.mocked(sendAlertPush).mockImplementation(async (sub) => (sub.endpoint === "https://push/gone" ? "gone" : "sent"));

    const r = await handleGmailNotification(n, "topic");

    expect(fetchMessages).toHaveBeenCalledWith("access", ["m1", "m2"]);
    const opts = vi.mocked(runPipeline).mock.calls[0][2]!;
    expect(opts.deadlineMs).toBe(60_000);
    expect(opts.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sendAlertPush).toHaveBeenCalledTimes(2); // only the high alert, to both subs
    expect(markProcessed).toHaveBeenCalledWith("me@x.com", ["m1", "m2"], "210");
    expect(removeSubscription).toHaveBeenCalledWith("me@x.com", "https://push/gone");
    expect(r).toEqual({ outcome: "processed", analyzed: 2, pushed: 1, removedSubscriptions: 1 });
  });

  it("caps analysis at the 10 most recent new messages", async () => {
    vi.mocked(getUser).mockResolvedValue(user({ processedIds: [] }));
    const ids = Array.from({ length: 13 }, (_, i) => `m${i}`);
    vi.mocked(listNewMessageIds).mockResolvedValue({ ids, historyId: "300", reset: false });
    vi.mocked(fetchMessages).mockResolvedValue([]);
    vi.mocked(runPipeline).mockResolvedValue([]);
    await handleGmailNotification(n, "topic");
    expect(vi.mocked(fetchMessages).mock.calls[0][1]).toEqual(ids.slice(-10));
    expect(markProcessed).toHaveBeenCalledWith("me@x.com", ids, "300");
  });

  it("resets historyId from a fresh watch when history is too old", async () => {
    vi.mocked(getUser).mockResolvedValue(user());
    vi.mocked(listNewMessageIds).mockResolvedValue({ ids: [], historyId: null, reset: true });
    vi.mocked(watch).mockResolvedValue({ historyId: "999", expiration: 123 });
    expect((await handleGmailNotification(n, "topic")).outcome).toBe("history_reset");
    expect(upsertUser).toHaveBeenCalledWith("me@x.com", { historyId: "999", watchExpiration: 123 });
    expect(runPipeline).not.toHaveBeenCalled();
  });
});
