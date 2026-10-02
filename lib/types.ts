export type VisaType = "VWP" | "B1" | "B2" | "B1/B2";

export interface Profile {
  visaType: VisaType;
  entryDate: string; // YYYY-MM-DD
  admitUntil?: string; // I-94 admit-until date, YYYY-MM-DD
  homeCountry?: string;
}

export type StayStatus = "ok" | "warning" | "critical" | "overstay" | "unknown";

export interface StayInfo {
  lastDay: string | null; // YYYY-MM-DD
  daysLeft: number | null;
  status: StayStatus;
  notes: string[];
  /** Set when the entered dates do not fit the visa's limits; the UI shows it prominently. */
  warning: string | null;
}

export type ItemSource = "email" | "action";

export interface InboxItem {
  id: string;
  source: ItemSource;
  from?: string;
  subject?: string;
  date?: string;
  body: string;
}

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical" | "unknown";

export interface TriageResult {
  relevant: boolean;
  category: string; // e.g. "employment", "payment", "travel", "stay", "study", "other"
  reason: string;
}

/** One factual claim in a verdict and the official rule that supports it. */
export interface Evidence {
  claim: string;
  ruleId: string;
}

export interface Verdict {
  risk: Exclude<RiskLevel, "unknown">;
  title: string;
  explanation: string;
  ruleIds: string[];
  whatToDoInstead: string;
  suggestedReply?: string;
  /** Every factual claim mapped to the official rule that supports it. */
  evidence?: Evidence[];
}

export interface Citation {
  ruleId: string;
  title: string;
  name: string;
  url: string;
  /** Verbatim sentence from the official page; used to scroll to and highlight it. */
  quote?: string;
}

export interface Alert {
  item: InboxItem;
  triage: TriageResult;
  verdict: Verdict | null;
  risk: RiskLevel;
  citations: Citation[];
  error?: string;
  /** True when the verdict flags a risk but cites no official rule; the UI marks it unverified. */
  unsourced?: boolean;
}

export type RuleScope = "B1" | "B2" | "VWP";

export interface Rule {
  id: string;
  title: string;
  appliesTo: RuleScope[];
  severity: "critical" | "high" | "medium" | "low";
  rule: string;
  examples: string[];
  alternatives: string[];
  /** `quote` is copied verbatim from the page at `url` so the link can highlight it. */
  citation: { name: string; url: string; quote?: string };
}

export interface ScanResponse {
  alerts: Alert[];
  scanned: number;
}

export interface CheckResponse {
  alert: Alert;
}

export interface ApiError {
  error: string;
}
