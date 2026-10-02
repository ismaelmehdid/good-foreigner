# Good Foreigner native app (Expo) — design + 1-hour plan

Status: approved idea, to build after the hackathon. Budget: **60 minutes of build time** for the core
app, run by the lead with an agent team. Native remote push is a separate, optional 45-minute phase.

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
| Google sign-in | `@react-native-google-signin/google-signin`: `configure({ iosClientId, webClientId, scopes: ["https://www.googleapis.com/auth/gmail.readonly"] })`, `signIn()`, `getTokens()` → `accessToken` used as the Gmail Bearer token |
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
    src/auth.ts                 ← Google sign-in, token refresh via getTokens()
    src/store.ts                ← secure-store user/profile, in-memory alerts (zustand-free, React context)
    src/notify.ts               ← local notifications + haptics
    src/ui/*                    ← RiskDot, AlertRow, StayCard, Section
    metro.config.js, tsconfig.json, app.json
```

## Prerequisites (before the hour starts, done by the user, ~15 min)

1. Xcode installed with an iOS simulator (the hour is measured on the simulator).
2. Google Cloud Console → Google Auth Platform → Clients → **Create client → iOS**, bundle ID
   `app.goodforeigner.mobile`. Note the iOS client ID and its reversed-client-ID URL scheme.
3. The existing web client ID is reused as `webClientId`.
4. Your Google account is still a test user on the consent screen.
5. Optional for a real phone: Expo account (`npx eas-cli login`) and an Apple Developer account.

## 60-minute plan (agent team)

| Time | Lead | `mobile-shell` | `mobile-screens` | `mobile-auth` |
|---|---|---|---|---|
| 0–10 | Create `mobile/` with `npx create-expo-app@latest mobile`, install deps, Metro/tsconfig shared paths, `app.json` (bundle id, Google sign-in plugin with URL scheme), commit | — | — | — |
| 10–35 | Review, unblock | Routing skeleton, tabs, formSheet route, `src/api.ts`, `src/store.ts` context | Welcome, onboarding screens, Home list, alert sheet, Check, Settings (against `src/store.ts` interface) | `src/auth.ts` (sign-in, getTokens, sign-out), `src/notify.ts` (permission, local alerts, haptics) |
| 35–50 | `npx expo run:ios` on the simulator, integrate, fix type errors | Fix integration bugs | Fix UI on simulator screenshots | Verify sign-in on simulator with the test account |
| 50–60 | End-to-end on simulator: sign in → onboarding → sample inbox → alert sheet → local notification; `npx tsc --noEmit`; commit | — | — | — |

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

Definition of done: on the iOS simulator, a test user signs in with Google, finishes onboarding, scans
the sample inbox and their Gmail, opens an alert in a half-height native sheet, taps an official
source, and receives a local notification for each risky alert.

## Phase 2 — native remote push (optional, ~45 min, needs a physical phone)

Push even when the app is closed, reusing today's Gmail → Pub/Sub → Cloud Run pipeline:

1. App: `GoogleSignin.configure({ offlineAccess: true, webClientId })` → `serverAuthCode`;
   `Notifications.getExpoPushTokenAsync()` (physical device only).
2. Server: `/api/realtime/enable` accepts `{ serverAuthCode, expoPushToken }` in addition to the web
   body; the code exchange uses `redirect_uri: ""` for native codes; `RealtimeUser` stores
   `expoPushTokens: string[]`.
3. Server: `lib/realtime/expoPush.ts` sends via `POST https://exp.host/--/api/v2/push/send` with the
   same title/body rules; the push handler sends to both Web Push subscriptions and Expo tokens.
4. Build with `eas build --profile development --platform ios` and install on the phone.

## Before a public launch (not part of the hour)

- `gmail.readonly` is a restricted scope: public release needs Google OAuth verification and a CASA
  security assessment; until then the app is limited to 100 test users.
- Apple Developer ($99/year) and Google Play ($25) accounts; App Store review for the privacy story.
- Automatic Gmail watch renewal (Cloud Scheduler → `/api/realtime/renew` daily).
