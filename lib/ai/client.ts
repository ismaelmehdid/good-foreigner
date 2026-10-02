import { GoogleGenAI } from "@google/genai";

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

/** Gemma 4 model used for cheap triage (read from env at call time). */
export function gemmaModel(): string {
  const m = process.env.GEMMA_MODEL;
  if (!m) throw new Error("GEMMA_MODEL is not set");
  return m;
}

export const TRIAGE_TIMEOUT_MS = 30_000;
export const ANALYZE_TIMEOUT_MS = 60_000;
