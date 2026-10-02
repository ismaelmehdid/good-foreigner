import { ThinkingLevel } from "@google/genai";
import type { InboxItem, Profile, TriageResult } from "@/lib/types";
import { getAI, gemmaModel, TRIAGE_TIMEOUT_MS } from "@/lib/ai/client";
import { parseModelJson } from "@/lib/ai/json";

const FAIL_OPEN: TriageResult = { relevant: true, category: "other", reason: "triage failed" };

const CATEGORIES = ["employment", "payment", "travel", "stay", "study", "immigration", "other"];

function buildPrompt(item: InboxItem, profile: Profile): string {
  const kind = item.source === "action" ? "planned action described by the user" : "email";
  return [
    "You are a triage filter for an app that protects U.S. visitors (B-1/B-2 visa or Visa Waiver Program/ESTA) from accidentally violating their immigration status.",
    `The user is in the U.S. on: ${profile.visaType}.`,
    "",
    `Decide whether the ${kind} below could matter for the user's immigration status.`,
    "Mark it RELEVANT if it touches ANY of: work or employment (paid or unpaid), payment, compensation, honoraria, prizes, contracts, invoices, tax forms (W-9, W-8BEN, 1099), job offers, freelancing, interviews, studying or courses, travel, leaving or re-entering the U.S., trips to Canada/Mexico/Caribbean, length of stay, extensions, visas, ESTA, I-94, immigration, marriage, residency, green cards.",
    "Mark it NOT relevant only if it is clearly unrelated (e.g. social plans, shopping, newsletters, accommodation logistics with no stay-length question).",
    "When in doubt, mark it relevant.",
    "",
    `Respond with ONLY a JSON object, no prose, no code fences, in exactly this shape:`,
    `{"relevant": true or false, "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(", ")}, "reason": "one short sentence"}`,
    "",
    `--- ${kind.toUpperCase()} START ---`,
    item.from ? `From: ${item.from}` : "",
    item.subject ? `Subject: ${item.subject}` : "",
    item.date ? `Date: ${item.date}` : "",
    item.body,
    `--- ${kind.toUpperCase()} END ---`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Gemma 4 triage. All instructions live in the user content (no system instruction, no JSON mode).
 * Never throws: on any failure the item is treated as relevant (fail open to Gemini).
 */
export async function triage(item: InboxItem, profile: Profile): Promise<TriageResult> {
  try {
    const res = await getAI().models.generateContent({
      model: gemmaModel(),
      contents: buildPrompt(item, profile),
      // Gemma 4 thinking: MINIMAL = off (fast triage).
      config: {
        temperature: 0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        httpOptions: { timeout: TRIAGE_TIMEOUT_MS },
      },
    });
    const parsed = parseModelJson<Partial<TriageResult>>(res.text ?? "");
    const relevant =
      typeof parsed.relevant === "boolean"
        ? parsed.relevant
        : String(parsed.relevant).toLowerCase() !== "false"; // anything ambiguous → relevant
    return {
      relevant,
      category: typeof parsed.category === "string" && parsed.category ? parsed.category : "other",
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch (err) {
    console.error(`[triage] item ${item.id} failed open:`, (err as Error).message);
    return { ...FAIL_OPEN };
  }
}
