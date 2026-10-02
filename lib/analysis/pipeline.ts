import type { Alert, Citation, InboxItem, Profile, RiskLevel, TriageResult, Verdict } from "@/lib/types";
import { rulesById } from "@/lib/rules/visitorRules";
import { isQuotaError, isTimeoutError } from "@/lib/ai/client";
import { triage, triageBatch } from "./triage";
import { analyze, analyzeBatch } from "./analyze";

export const MAX_BODY_CHARS = 2_000;
export const CONCURRENCY = 5;
/** Per-item fallback when the batch call fails: low concurrency to respect free-tier RPM. */
export const FALLBACK_CONCURRENCY = 2;
const ANALYZE_ERROR = "Could not analyze this item — retry.";

/** Whole-pipeline budget, well under Cloud Run's 300s request limit. */
export const PIPELINE_DEADLINE_MS = 90_000;
/** Triage phase budget; items still pending after it fail open (relevant). */
export const TRIAGE_PHASE_MS = 25_000;
/** Per-item fallback only runs if more than this remains before the deadline. */
export const MIN_FALLBACK_REMAINING_MS = 30_000;

/** User-facing reason for an item whose triage failed open (it simply goes to Gemini). */
export const TRIAGE_FALLBACK_REASON = "Checked directly by Gemini";
const TRIAGE_FAIL_OPEN: TriageResult = { relevant: true, category: "other", reason: TRIAGE_FALLBACK_REASON };

function friendlyTriage(t: TriageResult): TriageResult {
  return t.reason === "triage failed" ? { ...t, reason: TRIAGE_FALLBACK_REASON } : t;
}

/** One batched Gemma call for 2+ items, a single call for one item; fail open, never throws. */
async function triageAll(items: InboxItem[], profile: Profile, deadline: number): Promise<TriageResult[]> {
  try {
    if (items.length >= 2) {
      const map = await untilDeadline(triageBatch(items, profile, { deadline }), deadline, new Map());
      return items.map((it) => friendlyTriage(map.get(it.id) ?? TRIAGE_FAIL_OPEN));
    }
    return await Promise.all(
      items.map(async (it) =>
        friendlyTriage(await untilDeadline(triage(it, profile, { deadline }), deadline, { ...TRIAGE_FAIL_OPEN })),
      ),
    );
  } catch {
    return items.map(() => ({ ...TRIAGE_FAIL_OPEN }));
  }
}

export const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low", "unknown", "none"];

const VISA_TYPES = ["VWP", "B1", "B2", "B1/B2"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !ISO_DATE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function serverToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Client's local date (YYYY-MM-DD) from the request body, else the server's UTC date. */
export function parseToday(input: unknown): string {
  return isIsoDate(input) ? input : serverToday();
}

/** Validate a profile coming from an HTTP body. Returns null when invalid. */
export function parseProfile(input: unknown): Profile | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  if (!VISA_TYPES.includes(p.visaType as Profile["visaType"])) return null;
  if (!isIsoDate(p.entryDate)) return null;
  const profile: Profile = { visaType: p.visaType as Profile["visaType"], entryDate: p.entryDate };
  if (isIsoDate(p.admitUntil)) profile.admitUntil = p.admitUntil;
  if (typeof p.homeCountry === "string" && p.homeCountry.trim()) profile.homeCountry = p.homeCountry.trim().slice(0, 80);
  return profile;
}

export function truncateBody(item: InboxItem, max = MAX_BODY_CHARS): InboxItem {
  return item.body.length > max ? { ...item, body: item.body.slice(0, max) } : item;
}

/** Run `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function sortAlerts(alerts: Alert[]): Alert[] {
  return alerts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => RISK_ORDER.indexOf(x.a.risk) - RISK_ORDER.indexOf(y.a.risk) || x.i - y.i)
    .map(({ a }) => a);
}

/**
 * Deterministic sourcing check. Evidence must point at a known official rule (rulesById);
 * ruleIds = known model ruleIds ∪ evidence ruleIds. A risky verdict (not "none") with no
 * valid ruleIds or no valid evidence is `unsourced`, and its risk is raised to at least
 * "medium" (never lowered: high/critical stay as they are).
 */
export function enforceSourcing(v: Verdict): { verdict: Verdict; unsourced: boolean } {
  const evidenceIn = v.evidence ?? [];
  const known = new Set(rulesById([...v.ruleIds, ...evidenceIn.map((e) => e.ruleId)]).map((r) => r.id));
  const evidence = evidenceIn.filter((e) => known.has(e.ruleId) && e.claim.trim() !== "");
  const ruleIds = [...new Set([...v.ruleIds, ...evidence.map((e) => e.ruleId)])].filter((id) => known.has(id));
  const verdict: Verdict = { ...v, ruleIds, evidence };
  if (v.risk === "none") return { verdict, unsourced: false };
  const unsourced = ruleIds.length === 0 || evidence.length === 0;
  if (unsourced && v.risk === "low") verdict.risk = "medium";
  return { verdict, unsourced };
}

function citationsFor(verdict: Verdict): Citation[] {
  return rulesById(verdict.ruleIds).map((r) => ({
    ruleId: r.id,
    title: r.title,
    name: r.citation.name,
    url: r.citation.url,
  }));
}

/** Resolve `p`, or `fallback` once the absolute `deadline` passes (the call keeps running, ignored). */
function untilDeadline<T>(p: Promise<T>, deadline: number, fallback: T): Promise<T> {
  const ms = deadline - Date.now();
  if (ms <= 0) return Promise.resolve(fallback);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Verdicts for the items that need analysis. Several items → ONE batched Gemini call
 * (free tier allows ~5 requests/min/model); a single item → one plain call.
 * If the batch fails on a timeout or on quota (429 after every model), the items stay
 * unanalyzed (→ "unknown") right away. For other batch errors, fall back to per-item calls
 * (concurrency 2) only while more than 30s remain. Missing ids → no verdict.
 */
async function analyzeAll(
  items: InboxItem[],
  profile: Profile,
  today: string,
  deadline: number,
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  if (items.length === 0) return out;
  if (items.length > 1) {
    try {
      return await analyzeBatch(items, profile, { today, deadline });
    } catch (err) {
      const msg = String((err as Error).message).slice(0, 200);
      if (isTimeoutError(err) || isQuotaError(err)) {
        console.error(`[analyzeBatch] failed (timeout/quota), no per-item fallback:`, msg);
        return out;
      }
      if (deadline - Date.now() <= MIN_FALLBACK_REMAINING_MS) {
        console.error(`[analyzeBatch] failed with too little time left for per-item fallback:`, msg);
        return out;
      }
      console.error(`[analyzeBatch] failed, falling back to per-item:`, msg);
    }
  }
  await mapLimit(items, FALLBACK_CONCURRENCY, async (item) => {
    if (deadline - Date.now() <= 0) return;
    try {
      out.set(item.id, await analyze(item, profile, { today, deadline }));
    } catch (err) {
      console.error(`[analyze] item ${item.id} failed:`, String((err as Error).message).slice(0, 200));
    }
  });
  return out;
}

export interface PipelineOptions {
  /** User's local date, YYYY-MM-DD (defaults to the server's UTC date). */
  today?: string;
  /** Overall budget in ms (defaults to PIPELINE_DEADLINE_MS). */
  deadlineMs?: number;
}

/**
 * Triage every item (Gemma), analyze the relevant ones (Gemini), attach citations, sort by risk.
 * Items the user typed themselves (`source: "action"`) are always analyzed: the user asked.
 * The whole run is bounded by an overall deadline (~90s).
 */
export async function runPipeline(items: InboxItem[], profile: Profile, opts: PipelineOptions = {}): Promise<Alert[]> {
  const today = opts.today ?? serverToday();
  const start = Date.now();
  const deadline = start + (opts.deadlineMs ?? PIPELINE_DEADLINE_MS);
  const triageDeadline = Math.min(deadline, start + TRIAGE_PHASE_MS);
  const trimmed = items.map((it) => truncateBody(it));

  const triaged = await triageAll(trimmed, profile, triageDeadline);

  const needsAnalysis = (i: number) => triaged[i].relevant || trimmed[i].source === "action";
  const verdicts = await analyzeAll(trimmed.filter((_, i) => needsAnalysis(i)), profile, today, deadline);

  const alerts: Alert[] = trimmed.map((item, i) => {
    const t = triaged[i];
    if (!needsAnalysis(i)) return { item, triage: t, verdict: null, risk: "none", citations: [] };
    const raw = verdicts.get(item.id);
    if (!raw) return { item, triage: t, verdict: null, risk: "unknown", citations: [], error: ANALYZE_ERROR };
    const { verdict, unsourced } = enforceSourcing(raw);
    const alert: Alert = { item, triage: t, verdict, risk: verdict.risk, citations: citationsFor(verdict) };
    if (unsourced) alert.unsourced = true;
    return alert;
  });

  return sortAlerts(alerts);
}
