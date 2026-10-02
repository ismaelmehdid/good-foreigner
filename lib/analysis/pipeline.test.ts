import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InboxItem, Profile, Verdict } from "@/lib/types";

vi.mock("./triage", () => ({ triage: vi.fn() }));
vi.mock("./analyze", () => ({ analyze: vi.fn() }));
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

import { runPipeline, mapLimit, MAX_BODY_CHARS } from "./pipeline";
import { triage } from "./triage";
import { analyze } from "./analyze";

const profile: Profile = { visaType: "VWP", entryDate: "2026-08-01" };
const item = (id: string, body = id, source: InboxItem["source"] = "email"): InboxItem => ({ id, source, body });
const verdict = (risk: Verdict["risk"], ruleIds: string[] = []): Verdict => ({
  risk,
  title: risk,
  explanation: "e",
  ruleIds,
  whatToDoInstead: "w",
});

beforeEach(() => {
  vi.mocked(triage).mockReset();
  vi.mocked(analyze).mockReset();
});

describe("runPipeline", () => {
  it("skips analysis for irrelevant emails, sorts by risk, attaches citations, maps failures to unknown", async () => {
    vi.mocked(triage).mockImplementation(async (it) => ({
      relevant: it.id !== "dinner",
      category: "other",
      reason: "",
    }));
    vi.mocked(analyze).mockImplementation(async (it) => {
      if (it.id === "gig") return verdict("critical", ["no-paid-gigs-from-us-sources", "made-up"]);
      if (it.id === "conf") return verdict("low");
      throw new Error("boom");
    });

    const alerts = await runPipeline([item("dinner"), item("conf"), item("broken"), item("gig")], profile);

    expect(alerts.map((a) => [a.item.id, a.risk])).toEqual([
      ["gig", "critical"],
      ["conf", "low"],
      ["broken", "unknown"],
      ["dinner", "none"],
    ]);
    expect(analyze).toHaveBeenCalledTimes(3);
    expect(alerts[0].citations).toEqual([
      { ruleId: "no-paid-gigs-from-us-sources", title: "No paid gigs", name: "9 FAM 402.2", url: "https://fam.state.gov" },
    ]);
    expect(alerts[2].error).toBeTruthy();
    expect(alerts[2].verdict).toBeNull();
    expect(alerts[3].verdict).toBeNull();
  });

  it("truncates bodies before any model call", async () => {
    vi.mocked(triage).mockResolvedValue({ relevant: true, category: "other", reason: "" });
    vi.mocked(analyze).mockResolvedValue(verdict("none"));
    const alerts = await runPipeline([item("long", "x".repeat(5000))], profile);
    expect(vi.mocked(triage).mock.calls[0][0].body.length).toBe(MAX_BODY_CHARS);
    expect(vi.mocked(analyze).mock.calls[0][0].body.length).toBe(MAX_BODY_CHARS);
    expect(alerts[0].item.body.length).toBe(MAX_BODY_CHARS);
  });

  it("fails open when triage throws", async () => {
    vi.mocked(triage).mockRejectedValue(new Error("down"));
    vi.mocked(analyze).mockResolvedValue(verdict("high"));
    const alerts = await runPipeline([item("a")], profile);
    expect(alerts[0].risk).toBe("high");
    expect(alerts[0].triage.relevant).toBe(true);
  });

  it("always analyzes user actions even when triage says irrelevant", async () => {
    vi.mocked(triage).mockResolvedValue({ relevant: false, category: "other", reason: "" });
    vi.mocked(analyze).mockResolvedValue(verdict("medium"));
    const alerts = await runPipeline([item("act", "Can I go to Canada?", "action")], profile);
    expect(alerts[0].risk).toBe("medium");
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

describe("parseProfile", () => {
  it("accepts a valid profile and drops junk fields", async () => {
    const { parseProfile } = await import("./pipeline");
    expect(parseProfile({ visaType: "B1/B2", entryDate: "2026-08-01", admitUntil: "bad", x: 1 })).toEqual({
      visaType: "B1/B2",
      entryDate: "2026-08-01",
    });
  });
  it("rejects missing or invalid visa/entry date", async () => {
    const { parseProfile } = await import("./pipeline");
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile({ visaType: "F1", entryDate: "2026-08-01" })).toBeNull();
    expect(parseProfile({ visaType: "VWP", entryDate: "Aug 1" })).toBeNull();
  });
});
