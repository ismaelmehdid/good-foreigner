import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InboxItem, Profile, Verdict } from "@/lib/types";

vi.mock("./triage", () => ({ triage: vi.fn() }));
vi.mock("./analyze", () => ({ analyze: vi.fn(), analyzeBatch: vi.fn() }));
vi.mock("@/lib/rules/visitorRules", () => ({
  rulesById: (ids: string[]) =>
    ids
      .filter((id) => id === "no-paid-gigs-from-us-sources")
      .map((id) => ({
        id,
        title: "No paid gigs",
        appliesTo: ["VWP"],
        severity: "critical",
        rule: "r",
        examples: [],
        alternatives: [],
        citation: { name: "9 FAM 402.2", url: "https://fam.state.gov" },
      })),
}));

import { runPipeline, mapLimit, parseProfile, parseToday, MAX_BODY_CHARS, FALLBACK_CONCURRENCY } from "./pipeline";
import { triage } from "./triage";
import { analyze, analyzeBatch } from "./analyze";

const profile: Profile = { visaType: "VWP", entryDate: "2026-08-01" };
const item = (id: string, body = id, source: InboxItem["source"] = "email"): InboxItem => ({ id, source, body });
const verdict = (risk: Verdict["risk"], ruleIds: string[] = []): Verdict => ({
  risk,
  title: risk,
  explanation: "e",
  ruleIds,
  whatToDoInstead: "w",
});
const relevantUnless = (...irrelevant: string[]) =>
  vi.mocked(triage).mockImplementation(async (it) => ({
    relevant: !irrelevant.includes(it.id),
    category: "other",
    reason: "",
  }));

beforeEach(() => {
  vi.mocked(triage).mockReset();
  vi.mocked(analyze).mockReset();
  vi.mocked(analyzeBatch).mockReset();
});

describe("runPipeline", () => {
  it("analyzes all relevant items in ONE batch call, sorts by risk, cites rules, missing ids → unknown", async () => {
    relevantUnless("dinner");
    vi.mocked(analyzeBatch).mockResolvedValue(
      new Map([
        ["gig", verdict("critical", ["no-paid-gigs-from-us-sources", "made-up"])],
        ["conf", verdict("low")],
      ]),
    );

    const alerts = await runPipeline([item("dinner"), item("conf"), item("broken"), item("gig")], profile);

    expect(alerts.map((a) => [a.item.id, a.risk])).toEqual([
      ["gig", "critical"],
      ["conf", "low"],
      ["broken", "unknown"],
      ["dinner", "none"],
    ]);
    expect(analyzeBatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyzeBatch).mock.calls[0][0].map((i) => i.id)).toEqual(["conf", "broken", "gig"]);
    expect(analyze).not.toHaveBeenCalled();
    expect(alerts[0].citations).toEqual([
      { ruleId: "no-paid-gigs-from-us-sources", title: "No paid gigs", name: "9 FAM 402.2", url: "https://fam.state.gov" },
    ]);
    expect(alerts[2].error).toBeTruthy();
    expect(alerts[2].verdict).toBeNull();
    expect(alerts[3].verdict).toBeNull();
  });

  it("falls back to per-item analyze (concurrency 2) when the batch call fails", async () => {
    relevantUnless();
    vi.mocked(analyzeBatch).mockRejectedValue(new Error("batch response has no verdicts array"));
    let inFlight = 0;
    let peak = 0;
    vi.mocked(analyze).mockImplementation(async (it) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (it.id === "broken") throw new Error("boom");
      return verdict(it.id === "gig" ? "high" : "low");
    });

    const alerts = await runPipeline([item("a"), item("broken"), item("gig"), item("b")], profile);

    expect(analyze).toHaveBeenCalledTimes(4);
    expect(peak).toBeLessThanOrEqual(FALLBACK_CONCURRENCY);
    expect(alerts.map((a) => [a.item.id, a.risk])).toEqual([
      ["gig", "high"],
      ["a", "low"],
      ["b", "low"],
      ["broken", "unknown"],
    ]);
  });

  it("passes today and an absolute deadline to analysis", async () => {
    relevantUnless();
    vi.mocked(analyzeBatch).mockResolvedValue(new Map());
    const before = Date.now();
    await runPipeline([item("a"), item("b")], profile, { today: "2026-10-02" });
    const opts = vi.mocked(analyzeBatch).mock.calls[0][2]!;
    expect(opts.today).toBe("2026-10-02");
    expect(opts.deadline).toBeGreaterThan(before + 80_000);
    expect(opts.deadline).toBeLessThanOrEqual(Date.now() + 90_000);
  });

  it.each([
    ["timeout", Object.assign(new Error("This operation was aborted"), { name: "AbortError" })],
    ["quota", new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')],
  ])("does NOT run per-item fallback when the batch fails on %s", async (_label, err) => {
    relevantUnless();
    vi.mocked(analyzeBatch).mockRejectedValue(err);
    const alerts = await runPipeline([item("a"), item("b")], profile);
    expect(analyze).not.toHaveBeenCalled();
    expect(alerts.every((a) => a.risk === "unknown" && a.error)).toBe(true);
  });

  it("skips per-item fallback when 30s or less remain", async () => {
    relevantUnless();
    vi.mocked(analyzeBatch).mockRejectedValue(new Error("bad json"));
    const alerts = await runPipeline([item("a"), item("b")], profile, { deadlineMs: 20_000 });
    expect(analyze).not.toHaveBeenCalled();
    expect(alerts.map((a) => a.risk)).toEqual(["unknown", "unknown"]);
  });

  it("fails open when triage hangs past the deadline", async () => {
    vi.mocked(triage).mockImplementation(() => new Promise(() => {}));
    vi.mocked(analyze).mockResolvedValue(verdict("low"));
    const alerts = await runPipeline([item("a")], profile, { deadlineMs: 50 });
    expect(alerts[0].triage).toEqual({ relevant: true, category: "other", reason: "triage failed" });
  });

  it("uses a single analyze call (no batch) when only one item needs analysis", async () => {
    relevantUnless();
    vi.mocked(analyze).mockResolvedValue(verdict("medium"));
    const alerts = await runPipeline([item("one")], profile);
    expect(analyzeBatch).not.toHaveBeenCalled();
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(alerts[0].risk).toBe("medium");
  });

  it("maps a single-item analyze failure to unknown", async () => {
    relevantUnless();
    vi.mocked(analyze).mockRejectedValue(new Error("down"));
    const alerts = await runPipeline([item("one")], profile);
    expect(alerts[0].risk).toBe("unknown");
    expect(alerts[0].error).toBeTruthy();
  });

  it("truncates bodies before any model call", async () => {
    relevantUnless();
    vi.mocked(analyzeBatch).mockResolvedValue(new Map());
    const alerts = await runPipeline([item("long", "x".repeat(5000)), item("short")], profile);
    expect(vi.mocked(triage).mock.calls[0][0].body.length).toBe(MAX_BODY_CHARS);
    expect(vi.mocked(analyzeBatch).mock.calls[0][0][0].body.length).toBe(MAX_BODY_CHARS);
    expect(alerts.find((a) => a.item.id === "long")!.item.body.length).toBe(MAX_BODY_CHARS);
  });

  it("fails open when triage throws", async () => {
    vi.mocked(triage).mockRejectedValue(new Error("down"));
    vi.mocked(analyze).mockResolvedValue(verdict("high"));
    const alerts = await runPipeline([item("a")], profile);
    expect(alerts[0].risk).toBe("high");
    expect(alerts[0].triage.relevant).toBe(true);
  });

  it("always analyzes user actions even when triage says irrelevant", async () => {
    relevantUnless("act");
    vi.mocked(analyze).mockResolvedValue(verdict("medium"));
    const alerts = await runPipeline([item("act", "Can I go to Canada?", "action")], profile);
    expect(alerts[0].risk).toBe("medium");
  });

  it("makes no Gemini call when nothing is relevant", async () => {
    relevantUnless("a", "b");
    const alerts = await runPipeline([item("a"), item("b")], profile);
    expect(analyze).not.toHaveBeenCalled();
    expect(analyzeBatch).not.toHaveBeenCalled();
    expect(alerts.every((a) => a.risk === "none")).toBe(true);
  });
});

describe("mapLimit", () => {
  it("never exceeds the concurrency limit and keeps order", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 2;
    });
    expect(peak).toBe(5);
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
  });
});

describe("parseToday", () => {
  it("accepts a real YYYY-MM-DD date and falls back to the server date otherwise", () => {
    const server = new Date().toISOString().slice(0, 10);
    expect(parseToday("2026-10-02")).toBe("2026-10-02");
    expect(parseToday("2026-02-30")).toBe(server);
    expect(parseToday("10/02/2026")).toBe(server);
    expect(parseToday(undefined)).toBe(server);
  });
});

describe("parseProfile", () => {
  it("accepts a valid profile and drops junk fields", () => {
    expect(parseProfile({ visaType: "B1/B2", entryDate: "2026-08-01", admitUntil: "bad", x: 1 })).toEqual({
      visaType: "B1/B2",
      entryDate: "2026-08-01",
    });
  });
  it("rejects missing or invalid visa/entry date", () => {
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile({ visaType: "F1", entryDate: "2026-08-01" })).toBeNull();
    expect(parseProfile({ visaType: "VWP", entryDate: "Aug 1" })).toBeNull();
    expect(parseProfile({ visaType: "VWP", entryDate: "2026-13-40" })).toBeNull();
  });
});
