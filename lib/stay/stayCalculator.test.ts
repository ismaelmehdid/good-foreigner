import { describe, it, expect } from "vitest";
import { computeStay } from "./stayCalculator";

describe("computeStay", () => {
  it("uses I-94 admitUntil when present", () => {
    const s = computeStay({ visaType: "VWP", entryDate: "2026-08-01", admitUntil: "2026-10-29" }, "2026-10-02");
    expect(s.lastDay).toBe("2026-10-29");
    expect(s.daysLeft).toBe(27);
    expect(s.status).toBe("ok");
  });
  it("VWP without I-94 falls back to entry + 89 days and says so", () => {
    const s = computeStay({ visaType: "VWP", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s.lastDay).toBe("2026-10-29");
    expect(s.notes.join(" ")).toMatch(/i94\.cbp\.dhs\.gov/);
  });
  it("B2 without I-94 is unknown", () => {
    const s = computeStay({ visaType: "B2", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s.status).toBe("unknown");
    expect(s.daysLeft).toBeNull();
  });
  it("thresholds: warning <= 14, critical <= 3, overstay < 0", () => {
    const p = { visaType: "B2" as const, entryDate: "2026-08-01" };
    expect(computeStay({ ...p, admitUntil: "2026-10-16" }, "2026-10-02").status).toBe("warning");
    expect(computeStay({ ...p, admitUntil: "2026-10-05" }, "2026-10-02").status).toBe("critical");
    expect(computeStay({ ...p, admitUntil: "2026-10-01" }, "2026-10-02").status).toBe("overstay");
  });
  it("VWP adds no-extension and Canada/Mexico notes", () => {
    const s = computeStay({ visaType: "VWP", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s.notes.join(" ")).toMatch(/cannot be extended/);
    expect(s.notes.join(" ")).toMatch(/Canada/);
  });

  it("VWP I-94 date beyond day 90 is capped at day 90 with a warning, not rejected", () => {
    const s = computeStay(
      { visaType: "VWP", entryDate: "2026-08-01", admitUntil: "2026-11-15" },
      "2026-10-02",
    );
    expect(s.lastDay).toBe("2026-10-29");
    expect(s.daysLeft).toBe(27);
    expect(s.warning).toMatch(/90 days/);
    expect(s.warning).toMatch(/2026-10-29/);
  });
  it("VWP I-94 date within 90 days has no warning", () => {
    const s = computeStay(
      { visaType: "VWP", entryDate: "2026-08-01", admitUntil: "2026-10-27" },
      "2026-10-02",
    );
    expect(s.lastDay).toBe("2026-10-27");
    expect(s.warning).toBeNull();
  });
  it("B visa I-94 date beyond one year is kept (extensions exist) but flagged", () => {
    const s = computeStay(
      { visaType: "B2", entryDate: "2026-01-10", admitUntil: "2027-03-01" },
      "2026-10-02",
    );
    expect(s.lastDay).toBe("2027-03-01");
    expect(s.warning).toMatch(/I-539/);
  });
  it("B visa six-month admission has no warning", () => {
    const s = computeStay(
      { visaType: "B2", entryDate: "2026-08-01", admitUntil: "2027-01-31" },
      "2026-10-02",
    );
    expect(s.warning).toBeNull();
  });
  it("I-94 date before arrival is unknown with a warning", () => {
    const s = computeStay(
      { visaType: "B2", entryDate: "2026-08-01", admitUntil: "2026-07-01" },
      "2026-10-02",
    );
    expect(s.status).toBe("unknown");
    expect(s.lastDay).toBeNull();
    expect(s.warning).toMatch(/before your arrival/);
  });
});
