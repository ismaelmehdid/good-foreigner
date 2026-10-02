# Good Foreigner native app (Expo) — design + 1-hour plan

Status: approved idea, to build after the hackathon. Budget: **60 minutes of build time** for the core
app, run by the lead with an agent team. No Xcode or Android Studio: the app runs in **Expo Go** on the
user's own phone. Native remote push is a separate, optional 45-minute phase built in the cloud with EAS.

## Goal

A native iOS/Android app with native navigation, sheets, pickers and haptics that reuses the existing
Cloud Run backend unchanged. The web app keeps working.

## Why it fits in an hour

All logic already lives on the server behind stable HTTP endpoints:

| Endpoint | Used by the native app for |
|---|---|
| `POST /api/scan` `{ profile, today, demo?, skipIds? }` + `Authorization: Bearer <gmail token>` | Inbox scan, sample inbox |
| `POST /api/check` `{ text, profile, today }` | "Check before you act" |
| `POST /api/realtime/*`, `POST /api/gmail/push` | Phase 2 only |

Shared pure TypeScript (no DOM) is imported directly from the web repo: `lib/types.ts`,
`lib/stay/stayCalculator.ts`. So the hour is spent only on screens, sign-in and notifications.

## Scope of the 1-hour build (Phase 1)

In:
1. **Welcome** — logo, promise, native "Continue with Google", "Try the demo".
2. **Onboarding** — native stack, one question per screen: visa type, arrival date, I-94 date (or
   "I'm not sure"), notifications permission. Profile saved with `expo-secure-store`.
3. **Home tab** — stay card (big days-left number), "Scan Gmail" / "Try sample inbox", alert list
   grouped like the web app ("Needs your attention", "N look fine"), pull-to-refresh rescans.
4. **Alert detail** — native **form sheet** with detents (half / full): risk words, explanation,
   "Do this instead", suggested reply with Copy, "Why (official sources)" links opened with
   `expo-web-browser`, "Unverified" state.
5. **Check tab** — text box + example chips → `/api/check` → same alert detail.
6. **Settings tab** — profile summary, edit (reopens onboarding), notifications on/off, sign out.
7. **Local notifications** — after any scan, `expo-notifications` schedules an immediate local
   notification for each critical/high/medium alert (same text rules as `lib/notify/notify.ts`).
   Haptic (`expo-haptics`, warning) when a critical alert appears.

Out (Phase 2 or later): remote push when the app is closed, background fetch, Android build,
store submission, monorepo restructuring.

## Native building blocks

| Need | Choice |
|---|---|
| Routing | **Expo Router**: `(onboarding)` stack, `(tabs)` with Home · Check · Settings, `alert/[id]` presented as `formSheet` with `sheetAllowedDetents: [0.5, 1]` |
| Visa choice | `@expo/ui` Picker (SwiftUI on iOS) — fallback: large `Pressable` cards if `@expo/ui` misbehaves |
| Dates | `@react-native-community/datetimepicker` (inline iOS calendar) |
| Lists | `FlatList` with section headers, `RefreshControl` |
| Google sign-in | Expo Go cannot load `@react-native-google-signin`. Phase 1 uses a **web handoff**: `expo-web-browser` `openAuthSessionAsync("https://<cloud run>/api/mobile/auth/start?redirect=<Linking.createURL('auth')>")` → Google OAuth (authorization code, existing web client) → `/api/mobile/auth/callback` exchanges the code with the client secret → redirects to the app link with a short-lived Gmail access token, email and name. Phase 2 switches to native sign-in in the dev build. |
| Storage | `expo-secure-store` (user, profile) |
| Notifications | `expo-notifications` (local), `expo-haptics` |
| Links | `expo-web-browser` |
| Shared code | Metro `watchFolders: [repoRoot]` + tsconfig path `@core/* → ../lib/*` (types, stayCalculator only) |

## Layout

```
good-foreigner/
  app/, components/, lib/ ...   ← existing Next.js web app + API (unchanged)
  mobile/                       ← new Expo app
    app/_layout.tsx
    app/index.tsx               ← routes to welcome / onboarding / tabs
    app/welcome.tsx
    app/(onboarding)/{visa,arrival,i94,notifications}.tsx
    app/(tabs)/{_layout,home,check,settings}.tsx
    app/alert/[id].tsx          ← formSheet
    src/api.ts                  ← fetch wrapper, base URL = Cloud Run URL (env EXPO_PUBLIC_API_URL)
    src/auth.ts                 ← web-handoff sign-in (openAuthSessionAsync), parses the returned app link
    src/store.ts                ← secure-store user/profile, in-memory alerts (zustand-free, React context)
    src/notify.ts               ← local notifications + haptics
    src/ui/*                    ← RiskDot, AlertRow, StayCard, Section
    metro.config.js, tsconfig.json, app.json
```

## Where it runs (no Xcode, no Android Studio)

- **Phase 1: Expo Go** on the user's iPhone or Android phone. `npx expo start --tunnel` prints a QR
  code; scanning it opens the app instantly. Every module in Phase 1 (Expo Router, form sheets,
  datetimepicker, secure-store, web-browser, local notifications, haptics) is available in Expo Go.
  `@expo/ui` is used only if the installed Expo Go supports it; otherwise large `Pressable` cards.
- **Phase 2: EAS Build in the cloud** builds the development app (no Xcode). Installing it on an
  iPhone needs an Apple Developer account ($99/year); an Android APK installs on any Android phone.
- Expo does not host interactive cloud emulators for custom apps. Expo Snack has an in-browser
  device preview, but it cannot run this app's sign-in flow, so it is not used.

## Prerequisites (before the hour starts, done by the user, ~5 min)

1. Install **Expo Go** from the App Store / Play Store; phone and laptop on any network (`--tunnel`).
2. Add `https://good-foreigner-440338055401.us-central1.run.app/api/mobile/auth/callback` to the web
   OAuth client's **Authorized redirect URIs**.
3. Your Google account is still a test user on the consent screen.
4. Phase 2 only: Expo account (`npx eas-cli login`); Apple Developer account for an iPhone build.

## 60-minute plan (agent team)

| Time | Lead | `mobile-shell` | `mobile-screens` | `mobile-auth` |
|---|---|---|---|---|
| 0–10 | Create `mobile/` with `npx create-expo-app@latest mobile`, install deps, Metro/tsconfig shared paths, `app.json` (scheme `goodforeigner`, bundle id), commit | — | — | — |
| 10–35 | Review, unblock | Routing skeleton, tabs, formSheet route, `src/api.ts`, `src/store.ts` context | Welcome, onboarding screens, Home list, alert sheet, Check, Settings (against `src/store.ts` interface) | Server: `app/api/mobile/auth/{start,callback}/route.ts` (state check, redirect allow-list `exp://` / `goodforeigner://`, code exchange); app: `src/auth.ts`, `src/notify.ts` |
| 35–50 | Deploy the two auth routes to Cloud Run; `npx expo start --tunnel`, open in Expo Go on the phone, integrate, fix type errors | Fix integration bugs | Fix UI from phone screenshots | Verify sign-in on the phone with the test account |
| 50–60 | End-to-end on the phone: sign in → onboarding → sample inbox → alert sheet → local notification; `npx tsc --noEmit`; commit | — | — | — |

Interfaces fixed at minute 10 (so the three agents work in parallel):

```ts
// src/store.ts
type AppState = { user: GoogleUser | null; profile: Profile | null; alerts: Alert[]; gmailToken: string | null };
useApp(): AppState & {
  setProfile(p: Profile): Promise<void>; signIn(): Promise<void>; signOut(): Promise<void>;
  scan(mode: "gmail" | "demo"): Promise<void>; check(text: string): Promise<Alert>;
};
// src/api.ts
postScan(body, token?): Promise<ScanResponse>; postCheck(body): Promise<CheckResponse>;
// src/notify.ts
requestPermission(): Promise<boolean>; notifyAlerts(alerts: Alert[]): Promise<number>;
```

Definition of done: in Expo Go on the user's phone, a test user signs in with Google, finishes onboarding, scans
the sample inbox and their Gmail, opens an alert in a half-height native sheet, taps an official
source, and receives a local notification for each risky alert.

## Phase 2 — native remote push (optional, ~45 min, needs a physical phone)

Push even when the app is closed, reusing today's Gmail → Pub/Sub → Cloud Run pipeline:

1. App: `Notifications.getExpoPushTokenAsync()` (needs the EAS development build, not Expo Go).
   The Phase 1 auth callback already exchanges a code on the server, so it can store the encrypted
   refresh token and start the Gmail watch exactly like `/api/realtime/enable`.
2. Server: `RealtimeUser` stores `expoPushTokens: string[]`; a new `POST /api/mobile/push-token`
   registers the token for the signed-in user.
3. Server: `lib/realtime/expoPush.ts` sends via `POST https://exp.host/--/api/v2/push/send` with the
   same title/body rules; the push handler sends to both Web Push subscriptions and Expo tokens.
4. Build in the cloud with `eas build --profile development --platform ios` (or `android`) and
   install on the phone from the EAS link.

## Before a public launch (not part of the hour)

- `gmail.readonly` is a restricted scope: public release needs Google OAuth verification and a CASA
  security assessment; until then the app is limited to 100 test users.
- Apple Developer ($99/year) and Google Play ($25) accounts; App Store review for the privacy story.
- Automatic Gmail watch renewal (Cloud Scheduler → `/api/realtime/renew` daily).
