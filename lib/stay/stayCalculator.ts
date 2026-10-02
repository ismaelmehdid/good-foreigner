import type { Profile, StayInfo, StayStatus } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const VWP_MAX_DAYS = 90;
// 8 CFR 214.2(b)(1): a B-1/B-2 admission is for not more than one year; longer dates usually mean an
// approved I-539 extension, so they are kept but flagged.
const B_MAX_ADMISSION_DAYS = 365;

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
  let warning: string | null = null;
  let lastDayMs: number | null = null;
  const entryMs = parseDate(profile.entryDate);
  // Day of entry counts as day 1, so day 90 is entry + 89 days.
  const vwpLastDayMs = entryMs + (VWP_MAX_DAYS - 1) * DAY_MS;

  if (profile.admitUntil) {
    const admitMs = parseDate(profile.admitUntil);
    if (admitMs < entryMs) {
      warning =
        "Your I-94 date is before your arrival date. Check both dates on your I-94 at https://i94.cbp.dhs.gov.";
    } else if (profile.visaType === "VWP" && admitMs > vwpLastDayMs) {
      // Not rejected: CBP sometimes prints a wrong date. The 90-day limit still applies, so count
      // the safer date.
      lastDayMs = vwpLastDayMs;
      warning = `Your I-94 date is more than 90 days after you arrived. Visa Waiver Program stays never go beyond 90 days, so we count ${formatDate(vwpLastDayMs)} as your last day. If your I-94 really shows a later date, ask CBP to correct it.`;
    } else {
      lastDayMs = admitMs;
      if (profile.visaType !== "VWP" && admitMs > entryMs + B_MAX_ADMISSION_DAYS * DAY_MS) {
        warning =
          "Your I-94 date is more than one year after you arrived. That is normal only after an approved extension (Form I-539). Keep the approval notice with you, and double-check your I-94.";
      }
    }
  } else if (profile.visaType === "VWP") {
    lastDayMs = vwpLastDayMs;
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
    return { lastDay: null, daysLeft: null, status: "unknown", notes, warning };
  }

  const daysLeft = Math.round((lastDayMs - parseDate(today)) / DAY_MS);
  return { lastDay: formatDate(lastDayMs), daysLeft, status: statusFor(daysLeft), notes, warning };
}
