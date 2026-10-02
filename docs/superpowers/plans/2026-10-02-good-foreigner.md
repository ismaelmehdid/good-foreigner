# Good Foreigner Implementation Plan

> **For agentic workers:** Executed by an agent team (lead + 4 named teammates) working in parallel
> in one working tree. Each teammate owns ONLY the files listed in its task. Steps use checkbox
> (`- [ ]`) syntax for tracking. Time box: 2 hours total, deadline 4:45 PM submission.

**Goal:** Web app that scans a visitor's emails and planned actions and warns, with citations, when
something could violate B-1/B-2 or Visa Waiver Program rules.

**Architecture:** One Next.js app on Cloud Run. Client keeps profile in localStorage and gets a
Gmail read-only token from Google Identity Services. Server route handlers run a two-step pipeline:
Gemma 4 triage, then Gemini structured verdict grounded in a curated rules file.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind), Node 22, `@google/genai`, Gmail REST
API, Google Identity Services, Vitest, Cloud Run.

**Spec:** `docs/superpowers/specs/2026-10-02-good-foreigner-design.md`

## Global Constraints

- Node 22 (`nvm use 22`). Package manager: npm.
- All AI calls go through `lib/ai/client.ts`. API key mode only (Gemma 4 needs the Gemini API).
- Model IDs come from env: `GEMINI_MODEL`, `GEMMA_MODEL`. Never hard-code elsewhere.
- Secrets only in `.env.local` (git-ignored) and Cloud Run env vars. Never commit keys.
- Server-side env only: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMMA_MODEL`, `GOOGLE_CLIENT_ID`.
  `GOOGLE_CLIENT_ID` reaches the client as a prop from a server component (runtime, not build time).
- Email bodies are never persisted anywhere. Truncate bodies to 2,000 characters before any model call.
- Every UI screen shows the disclaimer: "Informational only — not legal advice. Confirm with an
  immigration attorney."
- Files are owned by exactly one task. Do not edit another task's files; message the lead instead.

## Review Focus

1. Model returns non-JSON or JSON wrapped in code fences → triage still parses; on failure item is
   treated as relevant (fail open), never dropped silently.
2. Gemini call fails or times out for one email → that alert shows `risk: "unknown"`, others still
   render.
3. Gmail token expired (401) → API returns 401 `{ error: "gmail_unauthorized" }`, UI asks to reconnect.
4. Profile without I-94 date for B visas → stay card says "Add your I-94 admit-until date" instead
   of showing wrong numbers.
5. Empty or very long "check before I act" input → 400 for empty, truncation for long.

---

## Shared contract (written by lead in Task 1, read-only for everyone else)

`lib/types.ts`:

```ts
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
```

HTTP contract:

- `POST /api/check` body `{ text: string, profile: Profile }` → 200 `CheckResponse` | 400 `ApiError`.
- `POST /api/scan` body `{ profile: Profile, demo?: boolean }`, header
  `Authorization: Bearer <gmail token>` when `demo` is not true → 200 `ScanResponse` |
  400 | 401 `{ error: "gmail_unauthorized" }` | 500.
- Alerts are sorted by risk: critical, high, medium, low, unknown, none.

---

### Task 1 (lead): Scaffold, types, stay calculator

**Files:**
- Create: Next.js app at repo root, `lib/types.ts`, `lib/stay/stayCalculator.ts`,
  `lib/stay/stayCalculator.test.ts`, `lib/profileStore.ts`, `.env.example`, `vitest.config.ts`

**Interfaces:**
- Produces: `computeStay(profile: Profile, today: string): StayInfo`,
  `loadProfile(): Profile | null`, `saveProfile(p: Profile): void`, `clearProfile(): void`.

- [ ] **Step 1: Scaffold**

```bash
source ~/.nvm/nvm.sh && nvm use 22
npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
npm i @google/genai
npm i -D vitest
```

- [ ] **Step 2: Write the failing test** `lib/stay/stayCalculator.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { computeStay } from "./stayCalculator";

describe("computeStay", () => {
  it("uses I-94 admitUntil when present", () => {
    const s = computeStay({ visaType: "VWP", entryDate: "2026-08-01", admitUntil: "2026-10-29" }, "2026-10-02");
    expect(s.lastDay).toBe("2026-10-29");
    expect(s.daysLeft).toBe(27);
    expect(s.status).toBe("ok");
  });
  it("VWP without I-94 falls back to entry + 89 days and says so", () => {
    const s = computeStay({ visaType: "VWP", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s.lastDay).toBe("2026-10-29");
    expect(s.notes.join(" ")).toMatch(/i94\.cbp\.dhs\.gov/);
  });
  it("B2 without I-94 is unknown", () => {
    const s = computeStay({ visaType: "B2", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s.status).toBe("unknown");
    expect(s.daysLeft).toBeNull();
  });
  it("thresholds: warning <= 14, critical <= 3, overstay < 0", () => {
    const p = { visaType: "B2" as const, entryDate: "2026-08-01" };
    expect(computeStay({ ...p, admitUntil: "2026-10-16" }, "2026-10-02").status).toBe("warning");
    expect(computeStay({ ...p, admitUntil: "2026-10-05" }, "2026-10-02").status).toBe("critical");
    expect(computeStay({ ...p, admitUntil: "2026-10-01" }, "2026-10-02").status).toBe("overstay");
  });
  it("VWP adds no-extension and Canada/Mexico notes", () => {
    const s = computeStay({ visaType: "VWP", entryDate: "2026-08-01" }, "2026-10-02");
    expect(s.notes.join(" ")).toMatch(/cannot be extended/);
    expect(s.notes.join(" ")).toMatch(/Canada/);
  });
});
```

- [ ] **Step 3: Run test, expect FAIL** — `npx vitest run lib/stay` → "Cannot find module".
- [ ] **Step 4: Implement** `computeStay` with UTC date math (`Date.UTC`), rules above.
- [ ] **Step 5: Run test, expect PASS.** Write `lib/types.ts` (contract above), `lib/profileStore.ts`
  (localStorage key `gf.profile`, every access in try/catch), `.env.example` with the 4 env names.
- [ ] **Step 6: Commit** `feat: scaffold app, shared types, stay calculator`.

### Task 2 (teammate `kb-author`): Rules knowledge base + sample inbox

**Files:**
- Create: `lib/rules/visitorRules.ts`, `lib/sample/inbox.ts`

**Interfaces:**
- Consumes: `Rule`, `InboxItem` from `lib/types.ts`.
- Produces: `export const VISITOR_RULES: Rule[]`, `export function rulesById(ids: string[]): Rule[]`,
  `export function rulesForPrompt(scope: RuleScope): string` (compact text: `[id] title — rule (source: url)`),
  `export const SAMPLE_INBOX: InboxItem[]`.

- [ ] **Step 1:** Write 20–30 rules from primary sources (9 FAM 402.2, 8 CFR 214.1(e), 8 CFR 214.2(b),
  8 CFR 217, INA 212(a)(9)(B), INA 222(g), INA 212(q), USCIS, CBP ESTA/VWP pages). Must include ids:
  `no-unauthorized-employment`, `no-paid-gigs-from-us-sources`, `permitted-business-activities`,
  `honoraria-212q`, `incidental-expense-reimbursement`, `remote-work-foreign-employer-gray`,
  `volunteering-limits`, `study-limits`, `contests-and-prizes-gray`, `vwp-90-day-limit`,
  `vwp-no-extension-or-change`, `vwp-contiguous-territory-clock`, `b2-i94-admit-until`,
  `b2-extension-i539`, `unlawful-presence-bars`, `visa-voidance-222g`, `misrepresentation`,
  `immigrant-intent`, `job-interviews-networking`.
- [ ] **Step 2:** Write 8 sample emails (ids `sample-1`…`sample-8`, source `"email"`):
  Anthropic paid feedback gig after event ($ amount, "send W-9/invoice") — expected high/critical;
  hackathon prize notice (gray); conference invitation without pay (none/low); Upwork contract offer
  from US client (high); friend dinner plan (none); home-country employer asks for a few remote
  days (gray/medium); Airbnb checkout reminder (none); friend suggests "a weekend in Vancouver
  resets your 90 days" (high — wrong advice).
- [ ] **Step 3:** `npx tsc --noEmit` passes for these files. Report to lead. Lead commits.

### Task 3 (teammate `ai-engineer`): AI client, triage, analysis, pipeline, API routes

**Files:**
- Create: `lib/ai/client.ts`, `lib/ai/json.ts`, `lib/ai/json.test.ts`, `lib/analysis/triage.ts`,
  `lib/analysis/analyze.ts`, `lib/analysis/pipeline.ts`, `app/api/check/route.ts`, `app/api/scan/route.ts`

**Interfaces:**
- Consumes: types; `VISITOR_RULES`, `rulesById`, `rulesForPrompt`, `SAMPLE_INBOX` (Task 2);
  `fetchInbox(token: string): Promise<InboxItem[]>` and `GmailAuthError` (Task 4).
- Produces: `triage(item, profile): Promise<TriageResult>`,
  `analyze(item, profile): Promise<Verdict>`, `runPipeline(items, profile): Promise<Alert[]>`,
  `parseModelJson<T>(text: string): T` (strips code fences, finds first `{...}`; throws on failure).

- [ ] **Step 1: Pin model IDs.** With the user's key:
  `curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY&pageSize=1000" | grep -oE '"models/(gemini|gemma)[^"]*"'`.
  Pick newest stable Gemini Flash and a Gemma 4 instruction-tuned model; write them to `.env.local`
  and report both IDs to the lead.
- [ ] **Step 2: TDD `parseModelJson`** — tests: plain JSON; JSON inside ```json fences; prose before
  JSON; invalid text throws.
- [ ] **Step 3: `lib/ai/client.ts`** — `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`, export
  `GEMINI_MODEL`, `GEMMA_MODEL`.
- [ ] **Step 4: `triage`** — Gemma: all instructions in user content (no system instruction, no JSON
  mode). Ask for `{"relevant":bool,"category":string,"reason":string}`. Relevant = anything touching
  work, payment, contracts, invoices, tax forms, job offers, studying, travel/exit/re-entry, length
  of stay, visas, immigration, marriage/residency. On any error return
  `{ relevant: true, category: "other", reason: "triage failed" }`.
- [ ] **Step 5: `analyze`** — Gemini with `systemInstruction` (role, profile, today, `rulesForPrompt`,
  "use only rule ids from the list", "say gray area when uncertain", "not legal advice") and
  `config.responseMimeType = "application/json"` + `responseSchema` matching `Verdict`.
- [ ] **Step 6: `runPipeline`** — truncate bodies to 2,000 chars; triage with concurrency 5; analyze
  relevant items with concurrency 5; irrelevant → `risk: "none"`, `verdict: null`; analyze error →
  `risk: "unknown"`, `error` set; citations from `rulesById(verdict.ruleIds)`; sort by risk order.
- [ ] **Step 7: Routes** — validate body; `/api/check` builds one `InboxItem` (`source: "action"`,
  body truncated to 4,000 chars, empty → 400); `/api/scan` demo → `SAMPLE_INBOX`, else Bearer token
  → `fetchInbox`, `GmailAuthError` → 401 `gmail_unauthorized`. `export const runtime = "nodejs"`.
- [ ] **Step 8: Verify** — `npm run dev`, then
  `curl -s localhost:3000/api/scan -H 'content-type: application/json' -d '{"demo":true,"profile":{"visaType":"VWP","entryDate":"2026-08-01"}}'`
  → the Anthropic gig email is `high` or `critical`. Report to lead.

### Task 4 (teammate `gmail-engineer`): Gmail fetch + Connect Gmail

**Files:**
- Create: `lib/gmail/fetchInbox.ts`, `lib/gmail/fetchInbox.test.ts`, `lib/gmail/useGmailToken.ts`,
  `components/ConnectGmailButton.tsx`

**Interfaces:**
- Produces: `class GmailAuthError extends Error`, `fetchInbox(token: string, max = 15): Promise<InboxItem[]>`,
  `extractPlainText(payload): string` (exported for tests),
  `useGmailToken(clientId: string | null): { token: string | null; request(): void; ready: boolean; error: string | null }`,
  `<ConnectGmailButton clientId={string|null} onToken={(t: string) => void} />` (renders nothing
  when `clientId` is null).

- [ ] **Step 1: TDD `extractPlainText`** — tests: single-part `text/plain` base64url body; multipart
  with nested `text/plain`; html-only falls back to tag-stripped text.
- [ ] **Step 2: `fetchInbox`** — `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=newer_than:30d`,
  then `GET .../messages/{id}?format=full` in parallel; headers From/Subject/Date; body =
  `extractPlainText` or `snippet`; 401 → `GmailAuthError`.
- [ ] **Step 3: `useGmailToken`** — inject `https://accounts.google.com/gsi/client` script once,
  `google.accounts.oauth2.initTokenClient({ client_id, scope: "https://www.googleapis.com/auth/gmail.readonly", callback })`,
  keep token in React state only.
- [ ] **Step 4:** `npx vitest run lib/gmail` passes; report to lead.

### Task 5 (teammate `ui-engineer`): Screens

**Files:**
- Create/replace: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/Dashboard.tsx`,
  `components/ProfileForm.tsx`, `components/StayCard.tsx`, `components/ScanPanel.tsx`,
  `components/AlertCard.tsx`, `components/ActionChecker.tsx`, `components/Disclaimer.tsx`,
  `components/RiskBadge.tsx`

**Interfaces:**
- Consumes: types, `computeStay`, `loadProfile/saveProfile/clearProfile`, `<ConnectGmailButton>`,
  HTTP contract above.
- Produces: the UI.

- [ ] **Step 1:** `app/page.tsx` server component: `export const dynamic = "force-dynamic"`, renders
  `<Dashboard googleClientId={process.env.GOOGLE_CLIENT_ID ?? null} />`.
- [ ] **Step 2:** `Dashboard` (client): no profile → hero ("Stay in status. Get warned before you
  act.") + `ProfileForm`; with profile → `StayCard`, `ScanPanel` ("Try with sample inbox" + Connect
  Gmail → "Scan my Gmail"), alerts list of `AlertCard`, `ActionChecker`, `Disclaimer`, "Edit profile".
- [ ] **Step 3:** `AlertCard`: `RiskBadge`, sender + subject, verdict title, explanation, "What to do
  instead", suggested reply (copy button), citation links (open new tab). Collapse `risk: "none"`
  alerts into one line "N emails look fine". Loading and error states for every request; 401 →
  "Gmail session expired — reconnect".
- [ ] **Step 4:** Mobile-first layout (max-w-2xl, 16px gutter), clear risk colors
  (critical red, high orange, medium amber, low blue, none green, unknown gray).
- [ ] **Step 5:** `npm run build` passes once all tasks land; report to lead.

### Task 6 (lead): Integrate, deploy, README

**Files:**
- Modify: `next.config.ts` (`output: "standalone"`)
- Create: `Dockerfile`, `.dockerignore`, `README.md`, `LICENSE` (MIT)

- [ ] **Step 1:** `npm run build && npx vitest run` green. Demo flow manually in the in-app browser.
- [ ] **Step 2:** Dockerfile (node:22-alpine, multi-stage, standalone, `PORT=8080`).
- [ ] **Step 3:** Deploy:
  `gcloud run deploy good-foreigner --source . --region us-central1 --allow-unauthenticated --set-env-vars GEMINI_API_KEY=...,GEMINI_MODEL=...,GEMMA_MODEL=...,GOOGLE_CLIENT_ID=...`
  (the user runs the key-bearing command or sets the key in the console).
- [ ] **Step 4:** Add Cloud Run URL to OAuth client's authorized JavaScript origins. Test demo + Gmail
  on the public URL.
- [ ] **Step 5:** README: problem, demo, architecture, Gemini + Gemma 4 (model IDs, Gemma terms link
  https://ai.google.dev/gemma/terms), Google tools used, privacy design, not-legal-advice. Commit.
