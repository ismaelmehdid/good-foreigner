import { describe, it, expect } from "vitest";
import { buildSystemInstruction, rulesTextForVisa } from "./analyze";

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
