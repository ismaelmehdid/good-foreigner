import { describe, it, expect } from "vitest";
import { buildSystemInstruction, rulesTextForVisa, validateVerdict, NO_RULE_SENTENCE } from "./analyze";

describe("buildSystemInstruction", () => {
  it("states today's date and the exact precomputed last day (VWP: entry + 89 days)", () => {
    const s = buildSystemInstruction({ visaType: "VWP", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s).toContain("Today's date: 2026-10-02.");
    expect(s).toContain("Last permitted day in the U.S.: 2026-10-29 (27 days left, status ok)");
    expect(s).toMatch(/never recompute it/);
    expect(s).not.toContain("2026-10-30 (");
  });

  it("uses the I-94 admit-until date when given and flags overstay", () => {
    const s = buildSystemInstruction(
      { visaType: "B2", entryDate: "2026-04-01", admitUntil: "2026-09-30" },
      "2026-10-02",
    );
    expect(s).toContain("Last permitted day in the U.S.: 2026-09-30 (2 days PAST the last permitted day — overstay, status overstay)");
  });

  it("says the last day is unknown when a B visa has no I-94 date", () => {
    const s = buildSystemInstruction({ visaType: "B2", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s).toMatch(/Last permitted day in the U\.S\.: unknown/);
    expect(s).toContain("i94.cbp.dhs.gov");
  });

  it("requires every claim to be sourced from a listed rule", () => {
    const s = buildSystemInstruction({ visaType: "VWP", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s).toMatch(/MUST appear in evidence as \{claim, ruleId\}/);
    expect(s).toMatch(/Never state a legal fact from general knowledge/);
    expect(s).toContain(NO_RULE_SENTENCE);
    expect(s).toMatch(/at least medium/);
  });

  it("includes the safety requirements", () => {
    const s = buildSystemInstruction({ visaType: "VWP", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s).toMatch(/Only cite rule ids from the list/);
    expect(s).toMatch(/gray area.*immigration attorney/);
    expect(s).toMatch(/informational, not legal advice/);
    expect(s).toMatch(/untrusted data/);
  });
});

describe("rulesTextForVisa", () => {
  it("B1/B2 includes B1 and B2 rules without duplicate lines", () => {
    const lines = rulesTextForVisa("B1/B2").split("\n");
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines.length).toBeGreaterThanOrEqual(rulesTextForVisa("B2").split("\n").length);
  });
});

describe("validateVerdict", () => {
  const base = { risk: "high", title: "t", explanation: "e", whatToDoInstead: "w" };

  it("drops evidence with unknown rule ids and unions ruleIds with evidence ids", () => {
    const v = validateVerdict({
      ...base,
      ruleIds: ["no-unauthorized-employment", "invented-rule"],
      evidence: [
        { claim: "Paid gigs from U.S. sources are not allowed", ruleId: "no-paid-gigs-from-us-sources" },
        { claim: "made up", ruleId: "invented-rule" },
        { claim: "  ", ruleId: "no-unauthorized-employment" },
      ],
    });
    expect(v.evidence).toEqual([
      { claim: "Paid gigs from U.S. sources are not allowed", ruleId: "no-paid-gigs-from-us-sources" },
    ]);
    expect(v.ruleIds).toEqual(["no-unauthorized-employment", "no-paid-gigs-from-us-sources"]);
  });

  it("tolerates a missing evidence array", () => {
    const v = validateVerdict({ ...base, risk: "none", ruleIds: [] });
    expect(v.evidence).toEqual([]);
    expect(v.ruleIds).toEqual([]);
  });
});
