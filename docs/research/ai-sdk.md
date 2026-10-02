## Corrections

1. **§2, who said 3.7 Flash was fixed.** The report says "A Google staff reply said 3.7 Flash was fixed." That is wrong. In the forum topic's Discourse JSON, the 3.7 Flash comment (Aug 17, 2026) was posted by `Arman_Sadeghi`, who is an ordinary user (`staff=false`). The only Google staff reply in the thread came from `Mustan_lokhand` (`staff=true`, title "Google"). That reply recommended the **two-call workaround**: a grounded search call first, then a second call that formats the result as JSON with no tools. The original poster confirmed the workaround works. So the report's two-call fallback is actually what Google staff suggested. Sources: https://discuss.ai.google.dev/t/google-search-grounding-drops-the-beginning-of-the-response-text-gemini-3-5-3-6-flash-json-output-starts-mid-sentence/176967 and https://discuss.ai.google.dev/t/176967.json
2. **Context, "Every ai.google.dev page now shows `client.interactions.create(...)`".** This overstates it. The Google Search, Structured output and Gemini 3 pages do lead with Interactions examples. But the Gemma-on-Gemini-API page (also on ai.google.dev) still uses only `generateContent` and chats, and the SDK README quickstart uses `ai.models.generateContent`. The quote "generateContent remains fully supported" is correct. Sources: https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api and https://ai.google.dev/gemini-api/docs/migrate-to-interactions
3. **§3, "No audio/video/PDF input for 26B/31B per the model card".** Only part of this is right.
   - **Correct:** no audio. The model card lists 26B A4B and 31B as "Text, Image", with audio only on E2B, E4B and 12B Unified.
   - **Wrong:** the model card does list "Video Understanding – Analyze video by processing sequences of frames" and "Document/PDF parsing" under Image Understanding as capabilities of the Gemma 4 family. It also says Video is supported on all models.
   - **Also missing:** Agent Platform's `gemma-4-26b-a4b-it-maas` page marks Video as "Not supported".
   - Sources: https://ai.google.dev/gemma/docs/core/model_card_4 and https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/google/gemma-4-26b-a4b-it
4. **§1, "There is no stable Pro model".** This is imprecise. `gemini-2.5-pro` is a stable model that is "not deprecated". However, Google is "limiting access to the 2.5 models to users who have actively used them in the past". What is true is that there is no stable Gemini 3.x Pro, and the only 3.x Pro is `gemini-3.1-pro-preview`, which has no free tier. Source: https://ai.google.dev/gemini-api/docs/models
5. **§3, "A Google DevRel blog post".** philschmid.de is the personal blog of Philipp Schmid, who is Google DeepMind DevRel. It is not an official Google blog. The post does say "structured JSON output" without code, which the report got right. It also says "256K context window on both models" and "Multimodal text, images, and video" for the two models on the Gemini API. That is a secondary source, not official API docs. Source: https://www.philschmid.de/gemma-4-gemini-api
6. **§4, "Region is `global` only".** This needs a nuance. Model availability is `global`, but ML processing is "Multi-region: us". The cited vertex-ai URL now 301-redirects to `/gemini-enterprise-agent-platform/models/maas/google/gemma-4-26b-a4b-it`. Source: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/google/gemma-4-26b-a4b-it
7. **§2, missing ToS caveat on the two-call fallback.** This is an addition, not a factual error. The Gemini API Terms forbid modifying Grounded Results. They allow keeping grounded text only "temporarily for the purpose of resubmitting the text of the Grounded Result in a subsequent prompt… to obtain a refined or improved Grounded Result". That is allowed only if you don't use the interim result for anything else, delete any undisplayed result, and display the associated Search Suggestions (up to 5) with the final result. Source: https://ai.google.dev/gemini-api/terms
8. **Minor wording (no change needed):** the tools table on the pricing page says the paid-tier 5,000 free search requests per month are shared across "all Gemini models". The per-model tables say "all Gemini 3.x models".

Everything else was confirmed against primary sources:
- **npm and Node versions:**
  - `@google/genai` latest is 2.27.0, published 2026-10-02.
  - It needs Node >=20.0.0, and the README says Node 22 for 3.0.0.
  - Local `node` is v14.21.3, and v22.18.0 is installed under nvm.
- **SDK flags and env vars:**
  - The `enterprise`/`vertexai` doc strings match the SDK.
  - `GOOGLE_GENAI_USE_ENTERPRISE` is supported.
  - When both keys are set, GOOGLE_API_KEY takes precedence, both in the SDK source and on the api-key docs page.
- **Model pages:**
  - Model IDs, statuses, token limits and prices match.
  - The 3.8 Flash thinking levels match, including the note that `minimal` returns an error.
  - The 3.5 Flash-Lite page lists no thinking levels.
- **Docs and SDK details:**
  - The structured-output "Preview" quote is accurate.
  - The JS docs sample uses `startIndex`, while the SDK type is `start_index` measured in bytes.
  - Interactions stores by default (`store=true`).
- **Gemma 4 on the Gemini API:**
  - The model IDs, thinking high/minimal, and JS samples (including Google Search) match the Gemma page.
  - The pricing page says Grounding is "Not available" and the paid tier is "Not available".
- **Billing and keys:**
  - The billing, Prepay, 402, 12-month expiry, Mar 2 2026 Welcome credit and Free Trial exclusion claims all match.
  - The Tier 1 caps ($10 per 10 minutes, $250 per month), ~10-minute lag, per-project limits, midnight-Pacific reset and auth keys from May 28, 2026 all match.
- **Agent Platform Gemma:** the `-maas` row (Experimental, 262,144 / 128,000, thinking Not supported, OpenAI-compatible endpoint) matches.
- **Snippets:** I re-ran the report's exact snippets with `tsc --strict` against SDK 2.27.0 and they compile with exit 0.

## Verified report

# Google Gen AI JS SDK (`@google/genai`): research brief, checked 2026-10-02 (fact-checked)

**Context you should know first**
- **Latest SDK version.** The npm registry shows `@google/genai` latest is **2.27.0**, published 2026-10-02. The SDK needs **Node 20 or later** (`engines: >=20.0.0`), and the README says "Starting from SDK version 3.0.0, Node.js version 22 or later is required". To avoid that update, pin `< 3.0.0`. On this machine the default `node` on PATH is **v14.21.3**, so run `nvm use 22` first; v22.18.0 and newer are installed. Sources: npm registry, package README.
- **Docs now prefer the Interactions API.** Most Gemini API guide pages now lead with `client.interactions.create(...)` examples: Google Search, Structured output and Gemini 3. The Gemma-on-Gemini-API page and the SDK README quickstart still use `generateContent`. The docs say "While generateContent remains fully supported, we recommend the Interactions API for all new development." The snippets below use `generateContent` as you asked, plus one Interactions version. Source: https://ai.google.dev/gemini-api/docs/migrate-to-interactions
- **Vertex AI has a new name.** It is now called **"Gemini Enterprise Agent Platform"**. In the SDK the new flag is `enterprise: true`. `vertexai: true` still works but is marked "The `enterprise` flag is recommended instead". If both are set to different values, the SDK throws. Source: SDK `genai.d.ts` and README.
- **Snippets type-check.** All the snippets below compile with `tsc --strict` against SDK 2.27.0; this was re-checked during fact-checking. **None of them were run live against the API.**

---

## 1. Latest stable model IDs
Source: https://ai.google.dev/gemini-api/docs/models (updated 2026-10-01)

| Use | Model ID | Status | Notes |
|---|---|---|---|
| (a) Fast, cheap classification | **`gemini-3.5-flash-lite`** | Stable (Jul 2026) | 1,048,576 in / 65,536 out. Supports structured output, search grounding and function calling. Paid price $0.30 in / $2.50 out per 1M tokens. |
| (a) Cheapest option | `gemini-3.1-flash-lite` | Stable | $0.25 (text/image/video) / $1.50 per 1M tokens. |
| (b) Reasoning with Search | **`gemini-3.8-flash`** | Stable (Sep 2026), "most intelligent Flash" | 1,048,576 in / 65,536 out. Thinking levels are `low`, `medium` and `high`. **`minimal` "is not supported and returns an error"**. Paid price $0.75 / $3.75 per 1M through Dec 31, 2026, then $1.50 / $7.50 from Jan 1, 2027. |

- **No stable Gemini 3.x Pro.** `gemini-3.1-pro-preview` is Preview only and has **no free tier** (paid $2.00 / $12.00 per 1M for prompts up to 200k tokens). `gemini-2.5-pro` is stable and not deprecated, but access is limited to users who already used the 2.5 models.
- `gemini-3-pro-preview`, `gemini-2.0-flash`, `gemini-2.0-flash-lite` and `gemini-3.1-flash-lite-preview` are shut down.
- The 2.5 models are limited to users who already used them. For new projects Google points to 3.5 Flash-Lite or 3.8 Flash.

Model pages:
- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/gemini-api/docs/pricing

## 2. Structured JSON output and `googleSearch` in one call
- **Yes, on Gemini 3 models, but it is marked Preview.** The docs say: "Preview: This feature is available only to Gemini 3 series models… combine Structured Outputs with built-in tools, including Grounding with Google Search, URL Context, Code Execution, File Search, and Function Calling."
  - Sources: https://ai.google.dev/gemini-api/docs/structured-output#structured-outputs-with-tools and https://ai.google.dev/gemini-api/docs/gemini-3
- **Caveat:** the docs only show the Interactions API version (`response_format` + `tools`). That `generateContent` accepts `responseJsonSchema` + `googleSearch` together comes from a user bug report, not the docs.
  - In that report (Aug 3, 2026), the JSON on `gemini-3.6-flash` (4 of 5 runs) and `gemini-3.5-flash` (1 of 3 runs) sometimes **started mid-sentence** when the search results carried many citations. `finishReason` was `STOP`. Using `responseMimeType` + `responseJsonSchema` did not prevent it.
  - A Google staff reply suggested splitting the work into two calls, and the reporter confirmed that works.
  - A separate, non-staff user later said 3.7 Flash no longer showed the issue as of Aug 17 and wasn't sure about other models.
  - Source: https://discuss.ai.google.dev/t/google-search-grounding-drops-the-beginning-of-the-response-text-gemini-3-5-3-6-flash-json-output-starts-mid-sentence/176967
- **Recommended fallback for a demo: two calls** (this matches the Google staff suggestion).
  1. A grounded call (`googleSearch`, plain text) that collects the answer and `groundingMetadata`.
  2. A second call on `gemini-3.5-flash-lite` with `responseJsonSchema` and no tools, which turns that text into JSON.
  - Keep the citations from call 1.
  - Always wrap `JSON.parse` in try/catch and validate the result, for example with Zod.
  - **ToS note:** the Gemini API Terms forbid modifying Grounded Results. They allow keeping grounded text only temporarily, to resubmit it to Google for a refined Grounded Result. That is allowed only if you don't use the interim result for anything else, delete any interim result that isn't displayed, and show the associated Search Suggestions (up to 5) with the final result. Source: https://ai.google.dev/gemini-api/terms

## 3. Gemma 4 on the Gemini API (AI Studio key)
- **Model IDs:** `gemma-4-31b-it` and `gemma-4-26b-a4b-it`, called through `generateContent`. Source: https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
- **Documented features** (with JS samples): system instructions, image input (via the Files API), multi-turn chat, function calling, Google Search grounding, and thinking. For thinking, the docs say "high" turns it on and "minimal" turns it off; there are no levels in between.
- **Context:** the model card gives **256K** for 12B, 26B A4B and 31B, and 128K for E2B/E4B. The **limit the hosted Gemini API enforces is not in the official docs**. Philipp Schmid's personal blog (he is Google DeepMind DevRel) says "256K context window on both models". Sources: https://ai.google.dev/gemma/docs/core and https://ai.google.dev/gemma/docs/core/model_card_4
- **JSON / structured output: not verified.** The Gemma-on-Gemini-API page has no `responseMimeType`/schema example. Philipp Schmid's personal blog says Gemma 4 handles "structured JSON output" but gives no code (https://www.philschmid.de/gemma-4-gemini-api). Test it, or fall back to prompt-only JSON plus validation.
- **Limitations compared with Gemini** (from https://ai.google.dev/gemini-api/docs/pricing):
  - Gemma 4 is **free tier only**; the paid tier is "Not available". So you probably can't raise its rate limits by paying, though that is an inference and not stated.
  - On the free tier, your data is "Used to improve our products: Yes".
  - The pricing table says **"Grounding with Google Search: Not available"** for Gemma 4, in both the free and paid columns. This **contradicts** the Gemma docs, which include a Google Search sample. Unverified, so don't rely on it.
  - **Audio:** the model card lists audio only for E2B, E4B and 12B Unified. 26B A4B and 31B are "Text, Image".
  - **Video and PDF:** the model card still lists "Video Understanding" (as sequences of frames) and "Document/PDF parsing" (under image understanding) as family capabilities. On the Gemini API, test video and PDF before relying on them. The pricing page doesn't cover modality.

## 4. SDK setup: API key mode vs Agent Platform mode (formerly Vertex)
```ts
// Gemini Developer API (AI Studio key). With no apiKey, Node reads GEMINI_API_KEY or GOOGLE_API_KEY; GOOGLE_API_KEY wins if both are set.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Agent Platform (formerly Vertex). Uses ADC: `gcloud auth application-default login`. project/location are Node only.
const ai2 = new GoogleGenAI({ enterprise: true, project: "PROJECT_ID", location: "global" }); // `vertexai: true` is still accepted
// Env-var form: GOOGLE_GENAI_USE_ENTERPRISE=true, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION
```
Sources: package README; https://ai.google.dev/gemini-api/docs/migrate-to-cloud; https://ai.google.dev/gemini-api/docs/api-key

**Which mode supports Gemma 4**
- **API key mode is the simple path.** Both Gemma IDs work through `generateContent`.
- **Agent Platform** offers only `gemma-4-26b-a4b-it-maas` as a managed (MaaS) model. Other sizes can be self-deployed through Model Garden on GPU/TPU.
  - Launch stage is **Experimental**, with a release date of Apr 3, 2026.
  - Model availability is `global`; ML processing is in the US multi-region.
  - Context is 262,144 tokens, with up to 128,000 output tokens.
  - Function calling and structured output are supported; **thinking is not**. Audio and video are "Not supported".
  - It is reached through the **OpenAI-compatible endpoint** (`.../endpoints/openapi/chat/completions`). I could not verify that `@google/genai` `generateContent` works for it.
  - Sources: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/google/gemma-4-26b-a4b-it (the old vertex-ai URL redirects here) and https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/call-open-model-apis

**How Google Cloud credits apply with an AI Studio key**
- The key belongs to a GCP project and uses that project's billing account.
- **The $300 Welcome/Free Trial credit cannot pay for Gemini API usage** for accounts opened after Mar 2, 2026. The Gemini API has been excluded from the Free Trial since March 2026.
- With **Prepay** billing (the default for new users), you must first **buy at least $5 of Prepay credit**. After that, *eligible* Google Cloud credits are used before your Prepay balance. When the Prepay balance reaches $0, the Cloud credits stop being used and every key on that billing account fails with **HTTP 402**.
- Purchased credits expire after 12 months.
- Sources: https://ai.google.dev/gemini-api/docs/billing and https://docs.cloud.google.com/free/docs/free-cloud-features
- **What this means for hackathon credits:** they are much more likely to apply in **Agent Platform mode** (`enterprise: true` + ADC). The Free Trial page only excludes "Gemini API in AI Studio" and partner MaaS models. I could not confirm whether your specific coupon type is "eligible" for the Gemini API.

## 5. TypeScript snippets (SDK 2.27.0)
```ts
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// (a) Structured classification
const r1 = await ai.models.generateContent({
  model: "gemini-3.5-flash-lite",
  contents: userText,
  config: {
    systemInstruction: "Classify the user's message.",
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["visa", "housing", "tax", "health", "other"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["category", "confidence"],
    },
    temperature: 0,
  },
});
const cls = JSON.parse(r1.text ?? "{}");

// (b) Google Search grounding + citations
const r2 = await ai.models.generateContent({
  model: "gemini-3.8-flash",
  contents: question,
  config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
});
const gm = r2.candidates?.[0]?.groundingMetadata;
const sources = (gm?.groundingChunks ?? []).map(c => ({ title: c.web?.title, uri: c.web?.uri }));
const citations = (gm?.groundingSupports ?? []).map(s => ({
  text: s.segment?.text, start: s.segment?.startIndex, end: s.segment?.endIndex, // BYTE offsets
  sources: (s.groundingChunkIndices ?? []).map(i => sources[i]),
}));
const searchWidgetHtml = gm?.searchEntryPoint?.renderedContent; // ToS requires showing Search Suggestions with grounded results
// one-call JSON variant: add responseMimeType + responseJsonSchema to the config above (Preview; see §2)

// (c) Gemma 4
const r3 = await ai.models.generateContent({
  model: "gemma-4-26b-a4b-it",
  contents: prompt,
  config: { systemInstruction: "Be concise.", thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }, // MINIMAL = off, HIGH = on
});
console.log(r3.text);

// Interactions API equivalent of (b)
const it = await ai.interactions.create({ model: "gemini-3.8-flash", input: question, tools: [{ type: "google_search" }] });
for (const step of it.steps ?? []) if (step.type === "model_output")
  for (const c of step.content ?? []) if (c.type === "text")
    for (const a of c.annotations ?? []) if (a.type === "url_citation") console.log(a.title, a.url, a.start_index, a.end_index);
```
- **Docs sample is wrong on field names.** The JS sample on the Google Search page uses `annotation.startIndex`. The SDK `URLCitation` type is actually **`start_index` / `end_index`** (snake_case), and the offsets are "measured in bytes". The `generateContent` `Segment.startIndex` is also in bytes.
- **Interactions stores data by default.** It stores each interaction server-side (`store=true`) unless you pass `store: false`.
- **Thinking level on Flash-Lite is unconfirmed.** The `gemini-3.5-flash-lite` page only says "Thinking: Supported", with no levels listed, so I left `thinkingConfig` out of (a).

Sources:
- https://ai.google.dev/gemini-api/docs/google-search
- https://ai.google.dev/gemini-api/docs/migrate-to-interactions
- https://ai.google.dev/gemini-api/terms
- SDK `dist/genai.d.ts`

## 6. Rate limits and free-tier caveats for a demo
Sources: https://ai.google.dev/gemini-api/docs/rate-limits, https://ai.google.dev/gemini-api/docs/pricing, https://ai.google.dev/gemini-api/docs/billing, https://ai.google.dev/gemini-api/docs/api-key

- **Exact per-model RPM/TPM/RPD numbers are no longer published in the docs.** They are only visible in AI Studio, so this is unverified. The docs only list Batch enqueued-token limits.
- Limits apply **per project, not per key**. RPD resets at midnight Pacific time. Experimental and Preview models have tighter limits.
- **Search grounding on the free tier is a likely demo blocker:**
  - The per-model pricing tables (Standard tier) say "Not available" for `gemini-3.8-flash`, and "Not available, can be tested in AI Studio" for 3.5 and 3.1 Flash-Lite.
  - The "Pricing for tools" table on the same page says "500 RPD free (limit shared for Flash and Flash-Lite)". **These contradict each other.**
  - **Plan on a billed (Tier 1) project for grounding.** The paid tier gives 5,000 free search requests per month shared across Gemini 3.x models, then $14 per 1,000. For Gemini 3, billing is **per search query** (one prompt can trigger several); for 2.5 and older it is per prompt.
- **Tier 1 limits:**
  - It needs a linked billing account, plus Prepay of at least $5.
  - Spending is capped at $10 per rolling 10 minutes (429 `RESOURCE_EXHAUSTED`, depending on billing history) and $250 per month at the billing-account level.
  - Billing data lags about 10 minutes, so overages are possible.
- On the free tier, your prompts and outputs are used to improve Google's products.
- **Key security:**
  - Keep the key on the server; the README warns against putting it in client-side code.
  - Since May 28, 2026, new AI Studio keys are "auth keys" bound to a service account.
  - Unrestricted standard keys are rejected. Restricted standard keys still work.
  - Since May 7, 2026, unrestricted keys that have been dormant for a long time are blocked.

## Not verified
- Whether structured output + `googleSearch` runs cleanly through `generateContent` on `gemini-3.8-flash` and `gemini-3.5-flash-lite`. The docs only show the Interactions version, and the truncation bug was reported on 3.5 and 3.6 Flash. A non-staff user reported 3.7 Flash as fixed.
- JSON/structured output, the hosted context limit, Google Search support, and video/PDF input for Gemma 4 on the Gemini API.
- Whether `@google/genai` with `enterprise: true` can call `gemma-4-26b-a4b-it-maas` through `generateContent`. The docs only show the OpenAI-compatible endpoint.
- Exact free-tier rate-limit numbers.
- Whether a specific hackathon or promo credit is "eligible" for the Gemini API.

Scratch files are in `/private/tmp/claude-501/-Users-ismaelmehdid-Desktop-good-foreigner/29bd49ca-56f1-4228-9585-ae9f9f08a348/scratchpad/tscheck/`:
- `snippets.ts`, the original type-checked snippets.
- `verify_report.ts`, the exact snippets from this report, re-checked with `tsc --strict` (exit 0).