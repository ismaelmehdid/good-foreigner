# Good Foreigner — stay in status

**Get warned before you accidentally break the rules of your U.S. visitor visa.**

Built at the SF Hacks x GDG AI Hackathon (October 2, 2026).

## The problem

Millions of people visit the U.S. every year on a B-1/B-2 visa or the Visa Waiver Program (ESTA).
The rules are strict and scattered across the Foreign Affairs Manual, federal regulations, USCIS and
CBP pages. One honest mistake — accepting a $150 paid feedback session, overstaying by a few days,
believing that a weekend in Canada "resets" the 90 days — can cost you the right to come back.

Lawyers are expensive, and asking a chatbot over and over is stressful. Good Foreigner watches what
you are about to do and warns you first, with the rule, the official source and a safer alternative.

This project started from a real situation: the author is on the Visa Waiver Program, was questioned
by CBP on arrival, and later received a small paid job offer from a U.S. company after attending its
event.

## What it does

- **Stay countdown** — days left before your I-94 admit-until date, with Visa Waiver Program caveats
  (no extension, Canada/Mexico trips do not reset the clock).
- **Inbox scan** — connects to Gmail with a read-only scope and flags emails that could lead to a
  violation (paid gigs, contracts, W-9 requests, remote work, travel plans). A sample inbox is
  available without signing in.
- **Check before you act** — paste a message you are about to send, or describe what you plan to do,
  and get a verdict.
- Every alert explains **why**, names the **rule** with a link to the **official source**, says **what
  to do instead**, and drafts a **polite reply** when an email asks for something risky.

## How it works

```
Browser ── profile in localStorage, Gmail token in memory (Google Identity Services)
   │
   ▼
Next.js API on Cloud Run
   POST /api/scan   → Gmail API (read-only) or sample inbox ─┐
   POST /api/check  → one planned action ────────────────────┤
                                                             ▼
   1. Gemma 4 (open-weight) triage: is this item immigration-relevant?
   2. Gemini structured verdict, grounded in a curated rules file with citations
```

- `lib/rules/visitorRules.ts` — 29 rules with official citations (9 FAM 402.2, 8 CFR 214.1/214.2/217,
  INA 212(a)(9)(B), 222(g), 212(q), USCIS, CBP).
- `lib/analysis/` — triage (Gemma), analysis (Gemini), pipeline.
- `lib/stay/stayCalculator.ts` — deterministic stay math, no AI.
- `lib/gmail/` — Gmail REST fetch and the read-only token flow.

## AI models

| Model | Role | License / terms |
|---|---|---|
| **Gemma 4** (`gemma-4-26b-a4b-it`, via the Gemini API) | First-pass triage of every email and action | Open weights, [Gemma Terms of Use](https://ai.google.dev/gemma/terms) |
| **Gemini** (`gemini-3.8-flash`, via the Gemini API) | Structured risk verdicts with rule ids, explanation, safer alternative and suggested reply | [Gemini API Terms](https://ai.google.dev/gemini-api/terms) |

Model IDs are configured with `GEMMA_MODEL` and `GEMINI_MODEL`.

## Google tools used

Gemini API, Gemma 4, Gmail API, Google Identity Services, Google AI Studio, Cloud Run, Cloud Build,
Artifact Registry.

## Privacy and responsible AI

- **Read-only Gmail scope.** The access token stays in browser memory and is never stored.
- **Nothing is persisted by this app.** Email bodies are never stored; the profile lives only in
  your browser. Recent inbox emails are sent to Google's Gemini API for analysis. Use a
  billing-enabled (paid tier) API key so that content is not used to improve Google's products.
- **Data minimization.** Gemma 4 screens every item first; only immigration-relevant items go on to
  the larger Gemini model. Because Gemma is open-weight, this screening step could later run fully
  on-device, so irrelevant emails would never leave the phone.
- **Every fact is sourced from official U.S. government rules.** The rules file cites only official
  sources (fam.state.gov, ecfr.gov, uscode.house.gov, uscis.gov, cbp.gov). Gemini must map every
  factual claim to one of those rules (`evidence: [{ claim, ruleId }]`) and may not state legal facts
  from general knowledge. The server drops citations to unknown rules; a warning with no official
  source is raised to at least "Be careful" and marked **Unverified** in the app.
- **Honest uncertainty.** Gray areas (remote work for a foreign employer, contest prizes, job
  interviews) are labeled as gray areas, with a recommendation to confirm with an attorney.
- **Known risks.** False negatives (saying OK when it is not) are the main risk, so the app is tuned to
  over-warn. Email content is treated as untrusted data and the prompt ignores instructions inside it.

> **Informational only — not legal advice.** Confirm with an immigration attorney.

## Run locally

Requires Node 22.

```bash
npm install
cp .env.example .env.local   # fill in GEMINI_API_KEY, GEMINI_MODEL, GEMMA_MODEL, GOOGLE_CLIENT_ID
npm run dev
npm test
```

`GOOGLE_CLIENT_ID` is an OAuth 2.0 web client with `http://localhost:3000` as an authorized
JavaScript origin and the Gmail API enabled. While the OAuth consent screen is in Testing mode, add
your Google account as a test user.

## Deploy to Cloud Run

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
scripts/deploy.sh
```

`scripts/deploy.sh` enables Cloud Run, Cloud Build and Artifact Registry, then deploys from source
with the values in `.env.local` passed as an env-vars file. Afterwards, add the Cloud Run URL to the
OAuth client's authorized JavaScript origins.

## License

[MIT](LICENSE)
