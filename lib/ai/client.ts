import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";

// All AI calls go through this module. API key mode only (Gemma 4 is served by the Gemini API).
// Created lazily so importing this module never throws when the key is missing.
let client: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Gemini model used for structured verdicts (read from env at call time). */
export function geminiModel(): string {
  const m = process.env.GEMINI_MODEL;
  if (!m) throw new Error("GEMINI_MODEL is not set");
  return m;
}

/** GEMINI_MODEL followed by optional comma-separated GEMINI_FALLBACK_MODELS (each has its own quota). */
export function geminiModels(): string[] {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([geminiModel(), ...fallbacks])];
}

/** Gemma 4 model used for cheap triage (read from env at call time). */
export function gemmaModel(): string {
  const m = process.env.GEMMA_MODEL;
  if (!m) throw new Error("GEMMA_MODEL is not set");
  return m;
}

export const TRIAGE_TIMEOUT_MS = 15_000;
export const ANALYZE_TIMEOUT_MS = 60_000;
export const ANALYZE_BATCH_TIMEOUT_MS = 60_000;

// Models that recently returned 429/503 are skipped until this timestamp (per server instance).
const cooldownUntil = new Map<string, number>();

/** 429 (quota) and 5xx (overloaded) are worth trying on another model. Timeouts are not (latency). */
export function isRetriable(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return /"code":\s*(429|500|502|503|504)\b|\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand/i.test(msg);
}

/** Quota exhausted (HTTP 429 / RESOURCE_EXHAUSTED). */
export function isQuotaError(err: unknown): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED/i.test(String((err as Error)?.message ?? err));
}

/** Request timed out, was aborted, or the caller's deadline ran out. */
export function isTimeoutError(err: unknown): boolean {
  const e = err as Error;
  return (
    e?.name === "AbortError" ||
    e?.name === "DeadlineError" ||
    /abort|timed? ?out|deadline/i.test(String(e?.message ?? err))
  );
}

export class DeadlineError extends Error {
  constructor(detail?: string) {
    super(`deadline exceeded${detail ? `: ${detail}` : ""}`);
    this.name = "DeadlineError";
  }
}

const MAX_BACKOFF_MS = 10_000;
/** Don't start a model call with less than this much time left before the deadline. */
const MIN_ATTEMPT_MS = 3_000;

/** Server-suggested retry delay ("retry in 40.4s"), or a short default for overload errors. */
function retryDelayMs(err: unknown): number {
  const m = String((err as Error)?.message ?? "").match(/retry in ([\d.]+)s/i);
  return m ? Number(m[1]) * 1000 : 2_000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call generateContent on the first available model; on quota/overload errors fall through
 * to the next model (each has its own quota). If every model fails, wait for the shortest
 * suggested retry delay (capped at 10s) and make one more pass. Every attempt's timeout is
 * clamped to the absolute `deadline` (ms epoch); when time runs out a DeadlineError is thrown.
 * `configFor(model)` lets callers adapt config (e.g. thinking) per model.
 */
export async function generateWithFallback(
  models: string[],
  params: Omit<GenerateContentParameters, "model" | "config">,
  configFor: (model: string) => GenerateContentParameters["config"],
  deadline: number = Infinity,
): Promise<{ res: GenerateContentResponse; model: string }> {
  let lastErr: unknown;
  const lastMsg = () => (lastErr ? String((lastErr as Error).message).slice(0, 120) : undefined);
  for (let pass = 0; pass < 2; pass++) {
    const now = Date.now();
    const ready = models.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
    const order = pass === 0 && ready.length ? ready : models;
    let minDelay = Infinity;
    for (const model of order) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) throw new DeadlineError(lastMsg());
      const config = configFor(model) ?? {};
      const timeout = Math.min(config.httpOptions?.timeout ?? Infinity, remaining);
      try {
        const res = await getAI().models.generateContent({
          ...params,
          model,
          config: { ...config, httpOptions: { ...config.httpOptions, timeout: Number.isFinite(timeout) ? timeout : undefined } },
        });
        cooldownUntil.delete(model);
        return { res, model };
      } catch (err) {
        lastErr = err;
        if (!isRetriable(err)) throw err;
        const delay = retryDelayMs(err);
        minDelay = Math.min(minDelay, delay);
        cooldownUntil.set(model, Date.now() + delay);
        console.warn(`[ai] ${model} unavailable:`, String((err as Error).message).slice(0, 160));
      }
    }
    if (pass === 0) {
      const wait = Math.min(minDelay, MAX_BACKOFF_MS, deadline - Date.now() - MIN_ATTEMPT_MS);
      if (wait < 0) break;
      await sleep(wait);
    }
  }
  throw lastErr;
}
