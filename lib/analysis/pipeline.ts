import type { Alert, Citation, InboxItem, Profile, RiskLevel, TriageResult, Verdict } from "@/lib/types";
import { rulesById } from "@/lib/rules/visitorRules";
import { triage } from "./triage";
import { analyze, analyzeBatch } from "./analyze";

export const MAX_BODY_CHARS = 2_000;
export const CONCURRENCY = 5;
/** Per-item fallback when the batch call fails: low concurrency to respect free-tier RPM. */
export const FALLBACK_CONCURRENCY = 2;
const ANALYZE_ERROR = "Could not analyze this item — retry.";

export const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low", "unknown", "none"];

const VISA_TYPES = ["VWP", "B1", "B2", "B1/B2"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate a profile coming from an HTTP body. Returns null when invalid. */
export function parseProfile(input: unknown): Profile | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  if (!VISA_TYPES.includes(p.visaType as Profile["visaType"])) return null;
  if (typeof p.entryDate !== "string" || !ISO_DATE.test(p.entryDate)) return null;
  const profile: Profile = { visaType: p.visaType as Profile["visaType"], entryDate: p.entryDate };
  if (typeof p.admitUntil === "string" && ISO_DATE.test(p.admitUntil)) profile.admitUntil = p.admitUntil;
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

function citationsFor(verdict: Verdict): Citation[] {
  return rulesById(verdict.ruleIds).map((r) => ({
    ruleId: r.id,
    title: r.title,
    name: r.citation.name,
    url: r.citation.url,
  }));
}

/**
 * Verdicts for the items that need analysis. Several items → ONE batched Gemini call
 * (free tier allows ~5 requests/min/model); a single item → one plain call. If the batch
 * call fails, fall back to per-item calls with concurrency 2. Missing ids → no verdict.
 */
async function analyzeAll(items: InboxItem[], profile: Profile): Promise<Map<string, Verdict>> {
  if (items.length === 0) return new Map();
  if (items.length > 1) {
    try {
      return await analyzeBatch(items, profile);
    } catch (err) {
      console.error(`[analyzeBatch] failed, falling back to per-item:`, (err as Error).message);
    }
  }
  const out = new Map<string, Verdict>();
  await mapLimit(items, FALLBACK_CONCURRENCY, async (item) => {
    try {
      out.set(item.id, await analyze(item, profile));
    } catch (err) {
      console.error(`[analyze] item ${item.id} failed:`, (err as Error).message);
    }
  });
  return out;
}

/**
 * Triage every item (Gemma), analyze the relevant ones (Gemini), attach citations, sort by risk.
 * Items the user typed themselves (`source: "action"`) are always analyzed: the user asked.
 */
export async function runPipeline(items: InboxItem[], profile: Profile): Promise<Alert[]> {
  const trimmed = items.map((it) => truncateBody(it));

  const triaged: TriageResult[] = await mapLimit(trimmed, CONCURRENCY, async (item) => {
    try {
      return await triage(item, profile);
    } catch {
      return { relevant: true, category: "other", reason: "triage failed" };
    }
  });

  const needsAnalysis = (i: number) => triaged[i].relevant || trimmed[i].source === "action";
  const verdicts = await analyzeAll(trimmed.filter((_, i) => needsAnalysis(i)), profile);

  const alerts: Alert[] = trimmed.map((item, i) => {
    const t = triaged[i];
    if (!needsAnalysis(i)) return { item, triage: t, verdict: null, risk: "none", citations: [] };
    const verdict = verdicts.get(item.id);
    if (!verdict) return { item, triage: t, verdict: null, risk: "unknown", citations: [], error: ANALYZE_ERROR };
    return { item, triage: t, verdict, risk: verdict.risk, citations: citationsFor(verdict) };
  });

  return sortAlerts(alerts);
}
