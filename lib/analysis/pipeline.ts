import type { Alert, Citation, InboxItem, Profile, RiskLevel, TriageResult, Verdict } from "@/lib/types";
import { rulesById } from "@/lib/rules/visitorRules";
import { triage } from "./triage";
import { analyze } from "./analyze";

export const MAX_BODY_CHARS = 2_000;
export const CONCURRENCY = 5;

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

  const alerts: Alert[] = await mapLimit(trimmed, CONCURRENCY, async (item, i) => {
    const t = triaged[i];
    if (!t.relevant && item.source !== "action") {
      return { item, triage: t, verdict: null, risk: "none", citations: [] };
    }
    try {
      const verdict = await analyze(item, profile);
      return { item, triage: t, verdict, risk: verdict.risk, citations: citationsFor(verdict) };
    } catch (err) {
      console.error(`[analyze] item ${item.id} failed:`, (err as Error).message);
      return {
        item,
        triage: t,
        verdict: null,
        risk: "unknown",
        citations: [],
        error: "Could not analyze this item — retry.",
      };
    }
  });

  return sortAlerts(alerts);
}
