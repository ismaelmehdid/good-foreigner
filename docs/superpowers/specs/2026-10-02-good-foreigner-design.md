# Good Foreigner — Design Spec

Date: 2026-10-02 (SF Hacks x GDG AI Hackathon, submission deadline 4:45 PM)

Build budget: 2 hours. Essentials first; extras only after a deployed, working demo.

## 1. Problem and intent

Visitors in the U.S. (B-1/B-2 visa, Visa Waiver Program/ESTA) can lose future access to the U.S. by
accidentally breaking the rules of their status: accepting a small paid gig, overstaying, doing
"work" that feels harmless. The rules are scattered across the Foreign Affairs Manual, CFR, USCIS
and CBP pages. Lawyers are expensive. People ask chatbots over and over and still worry.

Good Foreigner watches what the visitor is doing (emails, planned actions) and warns them **before**
they act, explaining why something is risky, which rule it touches, and what to do instead.

Origin story for the pitch: the author is on a visitor visa, was questioned by CBP on entry, and
later received a paid job offer from a U.S. company after attending its event.

### Success criteria for the demo

1. User enters visa type + entry date (+ I-94 admit-until date). Saved in localStorage.
2. Dashboard shows days left in the U.S. and a stay warning when close to the limit.
3. "Scan my inbox" (demo sample inbox first; real Gmail via "Connect Gmail" second) reads recent emails, flags the paid-job email as high risk with a
   plain-English explanation, the rule, citation link, and a safer alternative.
4. "Check before I act" box: user types e.g. "Can I accept the $500 hackathon prize?" or pastes a
   message they are about to send, and gets a verdict.
5. Demo mode with a sample inbox works without sign-in (fallback if OAuth fails on stage).
6. Deployed on Cloud Run with a public URL.

### Tracks

- Primary: GDG "Build with AI for Social Good" (Gemini core + Gmail API + Cloud Run + credits).
- Also: MLH "Best Use of Gemma 4" (Gemma 4 via Gemini API does triage) and MLH "Best Open-Source
  AI Project" (public GitHub repo, MIT license, Gemma named + license linked in README).

### Out of scope today (YAGNI)

Firebase Auth/Firestore (no accounts, no server-side storage), location monitoring, push
notifications, free-form chat, PWA manifest, native mobile app, SMS/WhatsApp reading, Gmail push
(Pub/Sub watch), multi-language UI, Google Search grounding.

## 2. Architecture

Single Next.js 15 app (App Router, TypeScript, Tailwind), Node 22, deployed to Cloud Run.

```
Browser (React client)
  ├─ Google Identity Services token client (gmail.readonly scope → access token, in memory)
  ├─ localStorage (profile only)
  └─ calls server API ──────────────┐
                                    ▼
Next.js route handlers (server, Cloud Run)
  POST /api/scan    { demo?, profile } + Bearer token → fetch Gmail (or sample inbox) → pipeline → Alert[]
  POST /api/check   { text, profile }                 → pipeline (single item) → Verdict
                                    │
                                    ▼
  lib/analysis/pipeline.ts
    1. triage (Gemma 4)   : item → { relevant, category, reason }      cheap, sees all raw items
    2. analyze (Gemini)   : relevant item + profile + rules KB → Verdict (structured JSON)
  lib/rules/visitorRules.ts : curated rules with citations (ground truth for prompts + UI links)
  lib/stay/stayCalculator.ts: deterministic days-left math (no AI)
```

API-first boundary: all monitoring logic lives behind `/api/*`, so a later Capacitor or Expo
mobile app reuses the same backend unchanged.

## 3. Units

| Unit | Purpose | Depends on |
|---|---|---|
| `lib/types.ts` | Shared types: `Profile`, `InboxItem`, `TriageResult`, `Verdict`, `Alert`, `RiskLevel` (`none/low/medium/high/critical`, plus `unknown` set only by the pipeline when analysis fails) | — |
| `lib/rules/visitorRules.ts` | Array of `Rule { id, title, appliesTo[], severity, rule, examples[], alternatives[], citation{name,url} }` | types |
| `lib/stay/stayCalculator.ts` | `computeStay(profile, today) → { lastDay, daysLeft, status, notes[] }`. VWP: entry + 90 days, no extension. B-1/B-2: I-94 admit-until date. Status thresholds: ok > 14 days, warning ≤ 14, critical ≤ 3, overstay < 0 | types |
| `lib/ai/client.ts` | One `GoogleGenAI` instance (API key mode, so Gemma 4 works), model IDs from env | `@google/genai` |
| `lib/analysis/triage.ts` | Gemma 4 prompt → JSON `{ relevant, category, reason }`. Parse defensively (strip code fences). On failure: treat as relevant (fail open to Gemini) | ai/client |
| `lib/analysis/analyze.ts` | Gemini structured-output call → `Verdict { risk: none/low/medium/high/critical, title, explanation, ruleIds[], whatToDoInstead, suggestedReply? }`. System prompt = role + profile + rules KB + "not legal advice" + "say uncertain when uncertain" | ai/client, rules |
| `lib/analysis/pipeline.ts` | `runPipeline(items, profile) → Alert[]`: triage all in parallel, analyze relevant ones in parallel (concurrency cap 5), attach rule citations from KB by `ruleIds` | triage, analyze, rules |
| `lib/gmail/fetchInbox.ts` | Gmail REST via fetch + bearer token: list last 15 messages (`newer_than:30d`), get each, extract from/subject/date/snippet/plain-text body (base64url), truncate body to 2,000 chars | — |
| `lib/sample/inbox.ts` | 8 sample emails: Anthropic paid feedback gig (high), hackathon prize notice (gray), conference invite (ok), Upwork contract offer (high), friend dinner (none), remote work request from home-country employer (gray), Airbnb reminder (none), "extend your stay?" travel note (stay) | types |
| `app/api/scan/route.ts`, `app/api/check/route.ts` | Validate input, call pipeline, return JSON. Errors → 4xx/5xx with message | lib/* |
| `lib/gmail/useGmailToken.ts` | Client hook: load GIS script, `initTokenClient` with `gmail.readonly`, return token | GIS |
| UI: `app/page.tsx` | Landing: problem line, "Sign in with Google", "Try demo" | — |
| UI: `app/dashboard/page.tsx` | Profile form (first run), stay countdown card, Scan button, alerts list (risk badge, explanation, what to do instead, rule citation links, suggested reply), Check-before-I-act box, disclaimer footer | components, API |

## 4. Data flow — inbox scan

1. Client has Google access token from the GIS token client (scope `gmail.readonly`).
2. Client `POST /api/scan` with profile and `Authorization: Bearer <token>`. Demo mode sends `demo: true` instead.
3. Server fetches up to 15 recent emails (or sample inbox).
4. Gemma 4 triage marks each email relevant/not. Irrelevant emails stop here and are not sent to
   Gemini (data minimization).
5. Gemini analyzes relevant emails and returns verdicts.
6. Server returns alerts sorted by risk. Client shows them. Nothing is persisted server-side.

## 5. Privacy and responsible AI

- Read-only Gmail scope. Token kept in memory, never stored.
- Nothing is persisted server-side. Profile lives in the browser's localStorage only.
- Gemma triage first: only immigration-relevant items reach the larger model. Gemma is open-weight,
  so the triage step could later run on-device.
- Every verdict cites a rule from the curated KB with an official source link.
- Clear "informational, not legal advice — confirm with an immigration attorney" disclaimer; model
  instructed to say "uncertain / gray area" instead of guessing.
- Risks named in the pitch: false negatives (app says OK when not), bias toward over-warning
  (accepted trade-off), sensitive data exposure (mitigated as above).

## 6. Error handling

- Gmail 401: client prompts re-sign-in (token expires after 1 hour).
- Triage failure on an item: item goes to Gemini anyway.
- Gemini failure on an item: alert with `risk: "unknown"` and "Could not analyze — retry".
- Missing profile: dashboard shows profile form before anything else.
- No Gmail OAuth client configured: "Connect Gmail" hidden, demo inbox still works.

## 7. Testing

- Unit tests (Vitest) for `stayCalculator` (VWP, B-2, thresholds, overstay) only — time-boxed.
- Manual end-to-end check with demo mode: paid-gig email must come back high or critical.
- Manual check with real Gmail on the deployed URL before judging.

## 8. Config

```
GEMINI_API_KEY=            # AI Studio key from the GCP project that holds the hackathon credits
GEMINI_MODEL=              # fast Gemini Flash model (exact ID from verified research)
GEMMA_MODEL=               # Gemma 4 model ID available on the Gemini API
GOOGLE_CLIENT_ID=   # OAuth web client ID, passed to the client at runtime by a server component; (consent screen in Testing mode, user added as test user)
```

## 9. Deployment

`gcloud run deploy good-foreigner --source . --region us-central1 --allow-unauthenticated`
with env vars set. Next.js `output: "standalone"`. Add the Cloud Run URL to the OAuth client's
authorized JavaScript origins.

## 10. Repo / license

Public GitHub repo, MIT license. README names Gemma 4 + links its terms, names Gemini, lists
Google tools used, and explains the privacy design.
