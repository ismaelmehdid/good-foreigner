import type { Profile, StayInfo, StayStatus } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const VWP_MAX_DAYS = 90;

function parseDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function statusFor(daysLeft: number): StayStatus {
  if (daysLeft < 0) return "overstay";
  if (daysLeft <= 3) return "critical";
  if (daysLeft <= 14) return "warning";
  return "ok";
}

/** Deterministic stay math. `today` is YYYY-MM-DD in the visitor's local calendar. */
export function computeStay(profile: Profile, today: string): StayInfo {
  const notes: string[] = [];
  let lastDayMs: number | null = null;

  if (profile.admitUntil) {
    lastDayMs = parseDate(profile.admitUntil);
  } else if (profile.visaType === "VWP") {
    // Day of entry counts as day 1, so day 90 is entry + 89 days.
    lastDayMs = parseDate(profile.entryDate) + (VWP_MAX_DAYS - 1) * DAY_MS;
    notes.push(
      "Estimated from your entry date. Confirm your exact admit-until date on your I-94 at https://i94.cbp.dhs.gov.",
    );
  } else {
    notes.push(
      "Add your I-94 admit-until date (https://i94.cbp.dhs.gov) to see how many days you have left.",
    );
  }

  if (profile.visaType === "VWP") {
    notes.push("Visa Waiver Program stays cannot be extended and you cannot change status.");
    notes.push(
      "Short trips to Canada, Mexico or nearby Caribbean islands do not reset your 90 days.",
    );
  }

  if (lastDayMs === null) {
    return { lastDay: null, daysLeft: null, status: "unknown", notes };
  }

  const daysLeft = Math.round((lastDayMs - parseDate(today)) / DAY_MS);
  return { lastDay: formatDate(lastDayMs), daysLeft, status: statusFor(daysLeft), notes };
}
