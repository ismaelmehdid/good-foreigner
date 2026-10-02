import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Alert } from "@/lib/types";

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({ default: { sendNotification } }));

import { alertPayload, sendAlertPush, sendTestPush, parseSubscription, TEST_PAYLOAD } from "./webPush";

const sub: PushSubscriptionJSON = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };
const alert = (risk: Alert["risk"], title = "Paid gig is work", instead = "Decline the payment"): Alert => ({
  item: { id: "gmail-1", source: "email", subject: "Offer", body: "..." },
  triage: { relevant: true, category: "employment", reason: "" },
  verdict: { risk: risk as never, title, explanation: "e", ruleIds: [], whatToDoInstead: instead },
  risk,
  citations: [],
});

beforeEach(() => {
  sendNotification.mockReset();
  vi.stubEnv("VAPID_SUBJECT", "https://example.app");
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
});
afterEach(() => vi.unstubAllEnvs());

describe("alertPayload", () => {
  it("uses notify.ts rules: title by risk, '<title> — <instead>' body capped at 120, tag = gmail id", () => {
    expect(alertPayload(alert("critical"))).toEqual({
      title: "Don't do this",
      body: "Paid gig is work — Decline the payment",
      tag: "gmail-1",
      url: "/",
    });
    expect(alertPayload(alert("medium")).title).toBe("Be careful");
    const long = alertPayload(alert("high", "x".repeat(200)));
    expect(long.body.length).toBe(120);
    expect(long.body.endsWith("…")).toBe(true);
  });
});

describe("send", () => {
  it("sends the JSON payload with VAPID details", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    expect(await sendAlertPush(sub, alert("high"))).toBe("sent");
    const [target, payload, opts] = sendNotification.mock.calls[0];
    expect(target).toEqual({ endpoint: sub.endpoint, keys: { p256dh: "p", auth: "a" } });
    expect(JSON.parse(payload).title).toBe("Don't do this");
    expect(opts.vapidDetails).toEqual({ subject: "https://example.app", publicKey: "pub", privateKey: "priv" });
  });

  it.each([404, 410])("returns gone on %s", async (statusCode) => {
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode }));
    expect(await sendTestPush(sub)).toBe("gone");
  });

  it("returns error on other failures and when VAPID is not configured", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    expect(await sendTestPush(sub)).toBe("error");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(await sendTestPush(sub)).toBe("error");
  });

  it("test push uses the 'alerts are on' title", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    await sendTestPush(sub);
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toEqual(TEST_PAYLOAD);
    expect(TEST_PAYLOAD.title).toBe("Good Foreigner real-time alerts are on");
  });
});

describe("parseSubscription", () => {
  it("accepts https endpoints with keys and rejects the rest", () => {
    expect(parseSubscription(sub)).toEqual({ ...sub, expirationTime: null });
    expect(parseSubscription({ endpoint: "http://x", keys: { p256dh: "p", auth: "a" } })).toBeNull();
    expect(parseSubscription({ endpoint: "https://x" })).toBeNull();
    expect(parseSubscription(null)).toBeNull();
  });
});
