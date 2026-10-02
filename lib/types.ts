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

export interface Verdict {
  risk: Exclude<RiskLevel, "unknown">;
  title: string;
  explanation: string;
  ruleIds: string[];
  whatToDoInstead: string;
  suggestedReply?: string;
}

export interface Citation {
  ruleId: string;
  title: string;
  name: string;
  url: string;
}

export interface Alert {
  item: InboxItem;
  triage: TriageResult;
  verdict: Verdict | null;
  risk: RiskLevel;
  citations: Citation[];
  error?: string;
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
  citation: { name: string; url: string };
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
