# Real-time email alerts — design

Goal: when a risky email lands in the user's Gmail inbox, their phone gets a notification within
seconds, even when the app is closed.

## Flow

```
Gmail inbox ──users.watch──▶ Pub/Sub topic gmail-inbox ──push subscription──▶
  Cloud Run POST /api/gmail/push?token=… ──▶ refresh user's Gmail access token (stored refresh token)
  ──▶ users.history.list since stored historyId ──▶ fetch new INBOX messages ──▶ runPipeline
  ──▶ Web Push (VAPID) to each stored PushSubscription ──▶ service worker "push" ──▶ phone notification
```

Polling (30 s live watch while the app is open) stays as the fallback.

## Infrastructure (project good-foreigner, region us-central1)

- APIs: pubsub.googleapis.com, firestore.googleapis.com (gmail, run, cloudbuild already on).
- Pub/Sub topic `gmail-inbox`; `serviceAccount:gmail-api-push@system.gserviceaccount.com` has
  `roles/pubsub.publisher` on that topic (required by Gmail push).
- Push subscription `gmail-inbox-push` → `https://good-foreigner-440338055401.us-central1.run.app/api/gmail/push?token=$PUSH_VERIFICATION_TOKEN`,
  ack deadline 120 s.
- Firestore (Native mode) default database, location `nam5`.
- Cloud Run runtime service account `440338055401-compute@developer.gserviceaccount.com` has
  `roles/datastore.user`.

## Environment variables (server-side; in .env.local and Cloud Run)

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_SECRET` | OAuth web client secret (code exchange) |
| `GOOGLE_CLOUD_PROJECT` | `good-foreigner` |
| `PUBSUB_TOPIC` | `projects/good-foreigner/topics/gmail-inbox` |
| `PUSH_VERIFICATION_TOKEN` | random 32+ chars; must match the `token` query param |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64; AES-256-GCM key for refresh tokens |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `https://good-foreigner-440338055401.us-central1.run.app` |
| `REALTIME_ENABLED` | `true` to show the feature; anything else hides it |

`VAPID_PUBLIC_KEY` and `REALTIME_ENABLED` reach the browser as props from the server component
`app/page.tsx` (runtime, not build time).

## Data (Firestore collection `users`, doc id = lowercased email)

```ts
interface RealtimeUser {
  email: string;
  refreshTokenEnc: string;        // AES-256-GCM, never logged
  profile: Profile;
  timezone: string;               // IANA, from the browser; used to compute "today"
  historyId: string;              // last processed Gmail history id
  watchExpiration: number;        // ms epoch, Gmail watch lasts ~7 days
  subscriptions: PushSubscriptionJSON[];
  processedIds: string[];         // last 200 Gmail message ids (Pub/Sub is at-least-once)
  updatedAt: number;
}
```

Email bodies are never stored.

## HTTP contract

- `POST /api/realtime/enable` body `{ code: string, profile: Profile, timezone: string, subscription: PushSubscriptionJSON }`
  → exchange `code` (GIS popup code flow, `redirect_uri: "postmessage"`) for tokens, read the email
  from the id_token, encrypt + store the refresh token, store profile/timezone/subscription (dedupe by
  endpoint), call Gmail `users.watch` `{ topicName: PUBSUB_TOPIC, labelIds: ["INBOX"], labelFilterBehavior: "include" }`,
  store `historyId` + `expiration`.
  → 200 `{ enabled: true, email, expiration }` | 400 `invalid_request` | 401 `code_exchange_failed`
  (also when no refresh token came back) | 503 `realtime_disabled` | 500 `enable_failed`.
- `POST /api/realtime/disable` body `{ endpoint: string }` → remove that subscription; when none left,
  call Gmail `users.stop` and delete the doc. → 200 `{ enabled: false }`.
- `POST /api/realtime/test` body `{ endpoint: string }` → Web Push "Good Foreigner real-time alerts are on"
  to that subscription if it is stored. → 200 `{ sent: true }` | 404.
- `POST /api/gmail/push?token=…` (Pub/Sub push) → 403 if token mismatch. Decode
  `message.data` (base64 JSON `{ emailAddress, historyId }`), load user, refresh access token,
  `users.history.list?startHistoryId=<stored>&historyTypes=messageAdded&labelId=INBOX`, skip
  processedIds, fetch new messages (max 10), `runPipeline` with today in the user's timezone and a
  60 s deadline, Web Push each critical/high/medium alert (same text rules as `notifyAlerts`), update
  historyId + processedIds. Remove subscriptions that return 404/410. Respond 204 after processing;
  respond 204 (ack) for unknown users so Pub/Sub does not retry forever.

## Web Push payload

```json
{ "title": "Don't do this", "body": "<verdict.title> — <whatToDoInstead>", "tag": "<gmail id>", "url": "/" }
```

The service worker `push` handler shows it with icon/badge `/icon-192.png`.

## Out of scope today

Automatic watch renewal (re-enable from the app renews it), multi-device management UI, Gmail
history gaps (`404 historyId too old` → reset historyId from the watch response and skip).
