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
});
