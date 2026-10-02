## Corrections

Most claims in the report check out against primary sources fetched on 2026-10-02. The confirmed items are:
- **Next.js:** 16.3.8 Active LTS, 15.5.27 Maintenance LTS, 16.3 released 2026-08-03, no 17 yet, minimum Node 20.9, Turbopack default, `next build` no longer lints, and the full `create-next-app` flag list.
- **gcloud CLI:** the `gcloud-cli` cask at 587.0.0 (formerly `google-cloud-sdk`).
- **Cloud Run:** every `gcloud run deploy` flag, the `cloud-run-source-deploy` repo, `roles/run.builder`, the buildpack Node defaults and pinning, the template Dockerfile, the `.gcloudignore` behaviour, and the env-var and secret syntax.
- **Firebase Auth:** the `OAuthCredential` properties, the redirect browser versions, and the localhost change dated 2025-04-28.
- **Google Identity Services (GIS) and the consent screen:** the GIS API names, the 100-test-user and 7-day rules, and `gmail.readonly` being Restricted.
- **Gmail API:** the list/get parameters and the Format enum.
- **Firebase SDKs and Firestore:** Firebase JS SDK 12.19.0 (2026-09-09, needs Node 20+), firebase-admin needing Node 22+, and `gcloud firestore databases create`.
- **Places API:** the searchNearby limits.
- **Geocoding API:** both v3 and v4 endpoints.

These are the claims that were wrong, incomplete or missing a caveat:

1. **Deployer roles are not enough to make the service public.** The three roles listed (`run.sourceDeveloper`, `iam.serviceAccountUser`, `serviceusage.serviceUsageConsumer`) are correct for a source deploy. But `--allow-unauthenticated` and `--no-invoker-iam-check` both need `run.services.setIamPolicy`. `roles/run.sourceDeveloper` only has `run.services.getIamPolicy`. The permission comes with `roles/run.admin`. The Next.js quickstart's own role list is `run.admin`, `run.sourceDeveloper`, `iam.serviceAccountUser` and `logging.viewer`. Sources: https://docs.cloud.google.com/run/docs/authenticating/public · https://docs.cloud.google.com/iam/docs/roles-permissions/run · https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service
2. **The official template Dockerfile uses pnpm and does not copy `public/`.** It runs `COPY package.json pnpm-lock.yaml ./` and `corepack enable pnpm && pnpm install --frozen-lockfile`, so it will fail on an npm project (the report's command uses `--use-npm`). It copies only `.next/standalone` and `.next/static`. The Next.js docs say the standalone `server.js` "does not copy the public or .next/static folders by default", so add `COPY --from=builder /app/public ./public`, as the `with-docker` example does. Sources: https://github.com/nextjs/deploy-google-cloud-run (raw Dockerfile) · https://nextjs.org/docs/app/api-reference/config/next-config-js/output
3. **`--set-build-env-vars` only applies to the buildpacks path.** The docs describe build env vars as a way "to pass configuration information to buildpacks when deploying from source code". With a Dockerfile, you need your own `ARG`/`ENV`, or hard-code the public config. Keys must be uppercase ASCII letters, digits and underscores. Source: https://docs.cloud.google.com/run/docs/configuring/services/build-environment-variables
4. **The Restricted-scope security assessment is conditional.** The Gmail scopes page says: "If you store restricted scope data on servers (or transmit), then you must go through a security assessment." Restricted-scope verification itself is always required for production. Source: https://developers.google.com/workspace/gmail/api/auth/scopes
5. **`hasGrantedAllScopes` takes a `TokenResponse` object, not a token string.** The signature is `hasGrantedAllScopes(tokenResponse, firstScope, ...restScopes)`, so keep the whole response object `r`. On script tags: the GIS loading guide uses `<script src="https://accounts.google.com/gsi/client" async></script>`, and the Gmail JS quickstart uses `async defer`. Both work. Source: https://developers.google.com/identity/oauth2/web/reference/js-reference · https://developers.google.com/identity/oauth2/web/guides/load-3p-authorization-library
6. **Places field mask: it is the mask that is required, not specifically the header.** It can go in the `X-Goog-FieldMask` header or the `$fields`/`fields` URL parameter. Leaving it out is an error, and spaces are not allowed in the list. The radius must be greater than 0 and at most 50000. Source: https://developers.google.com/maps/documentation/places/web-service/nearby-search
7. **`--yes` does not always mean the defaults.** It "skips prompts using saved preferences or defaults". If you saved preferences before, they are reused; use `--reset-preferences` to clear them. Source: https://nextjs.org/docs/app/getting-started/installation
8. **Firestore renamed its index types.** The docs now call composite indexes "manual indexes" ("previously known as single-field and composite indexes"). The behaviour is the same: an equality filter plus an `orderBy` on another field needs one, and the error message links to create it. Source: https://firebase.google.com/docs/firestore/query-data/index-overview
9. **Two secrets caveats were missing.**
   - Secret Manager discourages `echo ... | --data-file=-` because the value "appears as plaintext in the list of processes" and stays in shell history.
   - Cloud Run recommends pinning env-var secrets to a version number instead of `latest`, because they are resolved at instance startup.

   Sources: https://docs.cloud.google.com/secret-manager/docs/add-secret-version · https://docs.cloud.google.com/run/docs/configuring/services/secrets
10. **Open item #1 is now confirmed.** The Places REST reference states "Service: places.googleapis.com". The Geocoding REST reference states "Service: geocoding-backend.googleapis.com". Sources: https://developers.google.com/maps/documentation/places/web-service/reference/rest · https://developers.google.com/maps/documentation/geocoding/reference/rest
11. **Open item #2 is now resolved.** The Geocoding overview banner says "Version 4 of the Geocoding API is generally available", and `/v4/` is the GA channel. The usage-and-billing page says v4 methods have a default quota of 25 QPS. The "During Preview" note on start-v4 is leftover wording, but the 25 QPS limit still applies. Sources: https://developers.google.com/maps/documentation/geocoding/overview · https://developers.google.com/maps/documentation/geocoding/usage-and-billing
12. **Three of the "from memory" items (#8) are now confirmed.**
   - The `output: 'standalone'` plus `next start` warning exists. `packages/next/src/server/next.ts` logs: `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.`
   - The Firebase apiKey is not a secret, with a caveat: this only holds for "API keys restricted to Firebase services". Do not reuse that key for Maps.
   - `places.primaryTypeDisplayName` exists and triggers the Nearby Search **Pro** SKU.

   Sources: https://github.com/vercel/next.js/blob/canary/packages/next/src/server/next.ts · https://firebase.google.com/docs/projects/api-keys · https://developers.google.com/maps/documentation/places/web-service/nearby-search
13. **Extra precision on two Firebase items.**
   - firebase-admin needs Node 22+ starting with **v14.0.0 (2026-06-08)**, which dropped Node 18 and 20.
   - The 7-day test-user expiry does not apply if the app requests only the basic `openid`/`email`/`profile` scopes. It does apply to `gmail.readonly`.

   Sources: https://firebase.google.com/support/release-notes/admin/node · https://support.google.com/cloud/answer/15549945

These items are still unverified and are kept as flagged in the report:
- The Firebase Google access token is not refreshed or persisted. This is an inference, consistent with `OAuthCredential` having only `accessToken`, `idToken` and `secret`.
- The exact "Advanced → Go to (unsafe)" wording.
- Whether `snippet` comes back with `format=metadata`. The Message resource has `snippet`; the Format enum doesn't mention it.
- Browser CORS on the Gmail API (only implied by the browser quickstart).
- `GOOGLE_CLOUD_PROJECT` being needed for local ADC.
- The exact `access_denied` error for accounts that aren't test users.

## Verified report

# Hackathon stack research: Next.js on Google Cloud Run, Gmail via Google OAuth, Firestore, Maps (checked against official docs on 2026-10-02)

## 1. Next.js

- **Latest version:** Next.js **16.3.8** is the Active LTS, from the security release on 2026-09-30. 15.5.27 is the Maintenance LTS. 16.3 shipped on 2026-08-03. No 17 has been released.
- **Minimum Node.js:** **20.9**. If you use `firebase-admin` (v14+), target **Node 22+** (see section 5).
- **Defaults in 16.x:** Turbopack is the default bundler, and `next build` no longer runs the linter.

`--yes` skips the prompts and uses **saved preferences, or the defaults if none are saved**. The defaults are TypeScript, Tailwind, ESLint, App Router, Turbopack, the `@/*` import alias and AGENTS.md/CLAUDE.md. Add `--reset-preferences` to ignore saved choices.
```bash
npx create-next-app@latest my-app --yes
# explicit equivalent
npx create-next-app@latest my-app --ts --tailwind --app --eslint --import-alias "@/*" --agents-md --use-npm
```
Sources: https://nextjs.org/docs/app/getting-started/installation · https://nextjs.org/docs/app/api-reference/cli/create-next-app · https://nextjs.org/blog

## 2. Deploying to Cloud Run from source

**Install and authenticate on macOS.** The Homebrew cask was formerly called `google-cloud-sdk`; the current version is 587.0.0.
```bash
brew install --cask gcloud-cli
# optional, for extra components: export PATH=$HOMEBREW_PREFIX/share/google-cloud-sdk/bin:"$PATH"
gcloud auth login                         # authenticates the gcloud CLI itself
gcloud config set project PROJECT_ID
gcloud auth application-default login     # ADC for *your code* run locally (e.g. firebase-admin); separate from the CLI login
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
# app APIs used below:
gcloud services enable gmail.googleapis.com firestore.googleapis.com secretmanager.googleapis.com \
  geocoding-backend.googleapis.com places.googleapis.com
```
- The official quickstart only enables `run` and `cloudbuild`.
- The first `deploy --source` creates the Artifact Registry repo `cloud-run-source-deploy` and prompts you to enable any missing APIs.
- **IAM:** the build service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) needs `roles/run.builder`:
  ```bash
  gcloud projects add-iam-policy-binding PROJECT_ID \
    --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com --role=roles/run.builder
  ```
- **The person deploying from source** needs `roles/run.sourceDeveloper`, `roles/iam.serviceAccountUser` (on the service identity) and `roles/serviceusage.serviceUsageConsumer`.
  - **To make the service public** they also need `run.services.setIamPolicy`, which comes with `roles/run.admin`. `run.sourceDeveloper` lacks it.
  - The Next.js quickstart lists `run.admin`, `run.sourceDeveloper`, `iam.serviceAccountUser` and `logging.viewer`.
  - A project Owner already has all of these.

**Buildpacks or Dockerfile.** `--source .` uses your Dockerfile if one exists; otherwise it uses Google Cloud buildpacks.
- **Buildpacks (the quickstart path, zero config):** they run `npm run build` if that script exists, then `scripts.start` (`next start`). `next start` reads `PORT` (default 3000) and binds to `0.0.0.0` by default, and Cloud Run injects `PORT`.
  - **`output: 'standalone'` is not needed.** The official quickstart deploys a stock `npx -y create-next-app@16 helloworld --yes` project. If you set `standalone` and still run `next start`, Next.js logs a warning that it "does not work".
  - The buildpack uses the latest Node LTS by default. To pin it, set `"engines": {"node": "22.x"}` or `GOOGLE_NODEJS_VERSION`; the env var wins.
- **Dockerfile:** use `output: 'standalone'` and a multi-stage build that runs `node server.js`.
  - This is what the official template `github.com/nextjs/deploy-google-cloud-run` does: `node:lts-alpine`, copies `.next/standalone` and `.next/static`.
  - **Caveat: the template uses pnpm.** It copies `pnpm-lock.yaml` and runs `corepack enable pnpm`, so adapt it for npm.
  - **Caveat: the template does not copy `public/`.** The standalone server only serves `public` if you add `COPY --from=builder /app/public ./public`.
  - The Next.js `with-docker` example also sets `ENV HOSTNAME="0.0.0.0"` and copies `public`.

**Deploy:**
```bash
gcloud run deploy my-app --source . --region us-central1 --allow-unauthenticated \
  --set-build-env-vars NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-proj \
  --set-env-vars GMAIL_QUERY_DEFAULT=newer_than:7d \
  --set-secrets MAPS_API_KEY=maps-api-key:latest
```
- **Public access:** the docs recommend `--no-invoker-iam-check` over `--allow-unauthenticated`, which grants `roles/run.invoker` to `allUsers`. The `allUsers` method fails if the org enforces domain-restricted sharing. Both methods need `run.services.setIamPolicy`.
- **Env var flags:**
  - `--set-env-vars` replaces all existing variables; `--update-env-vars` merges.
  - `--env-vars-file` takes a YAML or `.env` file.
  - `PORT` is reserved.
  - Use `"^@^K1=a,b@K2=c"` when values contain commas.
  - `--set-build-env-vars` and its `--update-`/`--build-env-vars-file` variants pass values to **buildpacks** builds. Keys must be uppercase letters, digits and underscores.

**Gotcha: `NEXT_PUBLIC_*` values are baked in at build time.**
- Runtime `--set-env-vars` will not reach browser code.
- `create-next-app` adds `.env*` to `.gitignore`. If there is no `.gcloudignore` and a `.gitignore` exists, gcloud uses a generated Git-compatible `.gcloudignore` that respects `.gitignore`, so `.env*` files are not uploaded.
- To get public values into the build, do one of these:
  - Use `--set-build-env-vars` (buildpacks path only).
  - Use a custom `.gcloudignore`.
  - With a Dockerfile, use `ARG`/`ENV`.
  - Hard-code the public Firebase config in a `.ts` file.

**Secrets:**
```bash
gcloud secrets create maps-api-key --replication-policy=automatic
echo -n "KEY" | gcloud secrets versions add maps-api-key --data-file=-   # docs discourage: plaintext in process list/shell history; prefer --data-file=path
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor
```
Env-var secrets are resolved at instance startup. Google recommends pinning a version number instead of `latest`.

Sources: https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service · https://docs.cloud.google.com/run/docs/deploying-source-code · https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy · https://docs.cloud.google.com/docs/buildpacks/nodejs · https://docs.cloud.google.com/run/docs/configuring/services/environment-variables · https://docs.cloud.google.com/run/docs/configuring/services/build-environment-variables · https://docs.cloud.google.com/run/docs/configuring/services/secrets · https://docs.cloud.google.com/secret-manager/docs/add-secret-version · https://docs.cloud.google.com/run/docs/authenticating/public · https://docs.cloud.google.com/iam/docs/roles-permissions/run · https://docs.cloud.google.com/sdk/gcloud/reference/topic/gcloudignore · https://formulae.brew.sh/cask/gcloud-cli · https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment · https://nextjs.org/docs/app/guides/environment-variables · https://nextjs.org/docs/app/api-reference/cli/next · https://nextjs.org/docs/app/api-reference/config/next-config-js/output · https://github.com/nextjs/deploy-google-cloud-run

## 3. Google sign-in that also returns a Gmail access token

**(a) Firebase Auth, which gives you a Firebase user and a Google access token in one popup:**
```ts
import { GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup } from 'firebase/auth';
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
const result = await signInWithPopup(auth, provider);
const gmailToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken; // keep in memory + expiry
// on 401/expiry: await reauthenticateWithPopup(auth.currentUser!, provider) -> credentialFromResult again
```
- `OAuthCredential` has only `accessToken`, `idToken` and `secret`, plus `toJSON`/`fromJSON`. **There is no refresh token.**
- Firebase refreshes its own ID token, **not** the Google access token. The token only exists on the sign-in result, so after a page reload or about 1 hour you must run the popup again. This is inferred; see the open items.
- Use **popup, not redirect** on a `*.run.app` domain. Redirect sign-in breaks in Chrome M115+, Firefox 109+ and Safari 16.1+ when `authDomain` is a different domain. The docs list `signInWithPopup()` as a fix.
- Add the Cloud Run hostname under Firebase Auth → Settings → **Authorized domains**.
- `localhost` is no longer authorized by default for projects created after 2025-04-28. Add it manually.

**(b) Google Identity Services token client:**
```html
<script src="https://accounts.google.com/gsi/client" async></script>
```
```ts
let tokenResponse: google.accounts.oauth2.TokenResponse | undefined;
const client = google.accounts.oauth2.initTokenClient({
  client_id: CLIENT_ID,
  scope: 'https://www.googleapis.com/auth/gmail.readonly',
  callback: (r) => { if (!r.error) { tokenResponse = r; token = r.access_token; expiresAt = Date.now() + Number(r.expires_in) * 1000; } },
});
client.requestAccessToken({ prompt: 'consent' }); // first time; later: { prompt: '' }. Must be a user gesture.
```
- No refresh token; `TokenResponse` has none. A new token needs `requestAccessToken()` from a user gesture.
- Read `expires_in`, the lifetime in seconds. The docs' examples show 3600.
- Check scopes with `google.accounts.oauth2.hasGrantedAllScopes(tokenResponse, scope, ...more)`. It takes the **TokenResponse object**, not the token string.
- Revoke with `google.accounts.oauth2.revoke(accessToken, done)`.
- The OAuth client needs **Authorized JavaScript origins**: localhost and the run.app URL.
- GIS alone gives you no Firebase identity. Combine it with Firebase sign-in if you need a uid.
- If you need offline or refresh-token access, the authorization-code flow (`initCodeClient`) with a backend is the only option. That is overkill for a demo.

**Recommendation for a demo:** use (a). It is one click and the code is simplest. Handle a 401 by calling `reauthenticateWithPopup`.

**Consent screen** (Google Auth Platform → Branding / Audience / Data Access / Clients):
- Set the audience to **External** and leave it in **Testing**.
- Add every demo account under **Audience → Test users**. The limit is 100.
- Add the scope under **Data Access**.
- A test user's authorization **expires seven days after consent**. Any refresh token expires too. The exception is apps requesting only `openid`/`email`/`profile`, which does not apply here.
- `gmail.readonly` is a **Restricted** scope.
  - Production use needs restricted-scope verification.
  - A security assessment is also needed if you store or transmit restricted-scope data on servers.
  - None of this is feasible during a hackathon.
- Test users see an "unverified app" warning first; they click through it.
- Accounts that are not on the test-user list cannot authorize.
- Unverified apps that show this screen are capped at 100 new users in total.
- An **Internal** user type (Workspace org, users in that org only) skips verification.
- **Pre-register the judges' Gmail addresses as test users.**

Sources: https://firebase.google.com/docs/auth/web/google-signin · https://firebase.google.com/docs/reference/js/auth.oauthcredential · https://firebase.google.com/docs/auth/web/redirect-best-practices · https://firebase.google.com/docs/auth/faq-and-troubleshooting · https://developers.google.com/identity/oauth2/web/guides/use-token-model · https://developers.google.com/identity/oauth2/web/guides/load-3p-authorization-library · https://developers.google.com/identity/oauth2/web/reference/js-reference · https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model · https://developers.google.com/identity/protocols/oauth2 · https://developers.google.com/workspace/gmail/api/auth/scopes · https://support.google.com/cloud/answer/15549945 · https://support.google.com/cloud/answer/7454865 · https://developers.google.com/workspace/guides/configure-oauth-consent

## 4. Gmail REST calls with fetch

- **List:** `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=...&maxResults=10`
  - `maxResults` defaults to 100, maximum 500.
  - Also takes `pageToken`, `labelIds[]` and `includeSpamTrash`.
  - It returns only `id` and `threadId`, plus `nextPageToken` and `resultSizeEstimate`.
- **Get:** `GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`
  - `format` is one of `minimal`, `full`, `raw` or `metadata`.
  - `full` puts the parsed MIME tree in `payload`.
  - `raw` returns the whole RFC 2822 message as base64url.
  - `metadata` returns the ID, labels and headers only; `metadataHeaders[]` filters which headers.
- **`q` syntax** follows the Gmail search box (`from:`, `after:`, `newer_than:7d`, `is:unread`). Dates are read as midnight PST, so use Unix seconds for precision, e.g. `after:1388552400`.

```ts
const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
async function gmail<T = any>(path: string, token: string): Promise<T> {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${await r.text()}`);
  return r.json();
}
const qs = new URLSearchParams({ q: 'newer_than:7d', maxResults: '10' });
const { messages = [] } = await gmail(`/messages?${qs}`, token);
const full = await Promise.all(messages.map((m: any) =>
  gmail(`/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, token)));
const hdr = (m: any, n: string) =>
  m.payload?.headers?.find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value ?? '';
const rows = full.map((m: any) => ({ id: m.id, subject: hdr(m, 'Subject'), from: hdr(m, 'From'), snippet: m.snippet }));

// Body (format=full): payload.body.data / parts[].body.data are base64url
function b64url(data: string) {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
} // Node/server: Buffer.from(data, 'base64url').toString('utf8')
function body(p: any, mime = 'text/plain'): string | undefined {
  if (p?.mimeType === mime && p.body?.data) return b64url(p.body.data);
  for (const c of p?.parts ?? []) { const r = body(c, mime); if (r) return r; }
}
const text = body(msg.payload) ?? body(msg.payload, 'text/html');
```
Attachments come back as `body.attachmentId` instead of `data`.

Sources: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list · https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get · https://developers.google.com/workspace/gmail/api/reference/rest/v1/Format · https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages · https://developers.google.com/workspace/gmail/api/guides/filtering · https://developers.google.com/workspace/gmail/api/quickstart/js

## 5. Firestore

- The current Firebase JS SDK is **12.19.0** (2026-09-09). Version 12 requires Node 20+.
- Install with `npm i firebase`.
- Create the database with `gcloud firestore databases create --location=nam5`. That creates the `(default)` database, type `firestore-native`, edition `standard`.

```ts
// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const app = getApps()[0] ?? initializeApp({ apiKey: '…', authDomain: '…', projectId: '…', appId: '…' });
export const auth = getAuth(app);
export const db = getFirestore(app);

// in a 'use client' component
import { addDoc, collection, serverTimestamp, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
await addDoc(collection(db, 'items'), { uid, text, createdAt: serverTimestamp() });
const q = query(collection(db, 'items'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(20));
const unsub = onSnapshot(q, snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
// useEffect cleanup: return unsub;
```
`where` combined with `orderBy` on a different field needs a **manual (formerly "composite") index**. The error message links to create it.

**Admin SDK on a Cloud Run server route.** Install with `npm i firebase-admin`. It requires **Node.js 22+**; v14.0.0 (2026-06-08) dropped Node 18 and 20. On Cloud Run, `initializeApp()` uses ADC with no arguments.
```ts
// lib/admin.ts (server-only)
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const app = getApps()[0] ?? initializeApp();
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
// app/api/x/route.ts
export async function POST(req: Request) {
  const idToken = req.headers.get('authorization')?.slice(7) ?? '';
  const { uid } = await adminAuth.verifyIdToken(idToken); // client sends await auth.currentUser.getIdToken()
  await adminDb.collection('items').add({ uid, createdAt: new Date() });
  return Response.json({ ok: true });
}
```

| | Client SDK (browser) | Admin SDK (Cloud Run route) |
|---|---|---|
| Auth | Signed-in Firebase user | Service account via ADC |
| Security rules | Enforced, so you must write them | **Bypassed**; access is controlled by IAM (`roles/datastore.user`) |
| Realtime `onSnapshot` | Yes | Not for pushing updates to the UI |
| Best for | Live UI and simple CRUD | Trusted writes, secrets, calls to Gmail or Maps with server keys |

Hackathon pattern: write through Admin in route handlers, read live with the client `onSnapshot`, and use rules that allow each user to read only their own documents.

Sources: https://firebase.google.com/support/release-notes/js · https://firebase.google.com/support/release-notes/admin/node · https://firebase.google.com/docs/firestore/quickstart · https://firebase.google.com/docs/firestore/manage-data/add-data · https://firebase.google.com/docs/firestore/query-data/listen · https://firebase.google.com/docs/firestore/query-data/index-overview · https://firebase.google.com/docs/admin/setup · https://firebase.google.com/docs/firestore/security/get-started · https://docs.cloud.google.com/firestore/native/docs/security/iam · https://docs.cloud.google.com/sdk/gcloud/reference/firestore/databases/create

## 6. Google Maps Platform

- **Nearby place name and type** use **Places API (New)**, service `places.googleapis.com`:
  - Endpoint: `POST https://places.googleapis.com/v1/places:searchNearby`
  - A **field mask is required**, passed in the `X-Goog-FieldMask` header or the `$fields`/`fields` URL parameter. Omitting it is an error, and spaces are not allowed.
  - Radius must be greater than 0 and at most 50000 m. `maxResultCount` is 1–20 (default 20). `rankPreference` is `POPULARITY` (default) or `DISTANCE`.
  ```ts
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.MAPS_API_KEY!,
      'X-Goog-FieldMask': 'places.displayName,places.primaryType,places.types,places.formattedAddress' }, // Pro SKU fields
    body: JSON.stringify({ maxResultCount: 5, rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 50 } } }),
  });
  const { places = [] } = await r.json(); // places[0].displayName.text, places[0].primaryType
  ```
  - `places.primaryTypeDisplayName` is also available and is a **Pro** SKU field.
- **Reverse geocoding** uses the **Geocoding API**, service `geocoding-backend.googleapis.com`. Two versions are available:
  - v3: `GET https://maps.googleapis.com/maps/api/geocode/json?latlng=LAT,LNG&key=KEY`, optionally with `result_type` and `location_type` (post-search filters). It returns `results[].formatted_address`, `place_id`, `types` and `address_components`.
  - v4 (GA, `/v4/` channel): `GET https://geocode.googleapis.com/v4/geocode/location/LAT,LNG` with the `X-Goog-Api-Key` header. It returns all fields by default, so the field mask is optional. It returns `results[].formattedAddress`, `placeId`, `types` and `addressComponents`. Default quota is 25 QPS.
- Call both from a server route using the Secret Manager key, and restrict that key to these APIs. Do not reuse the Firebase web apiKey for Maps.

Sources: https://developers.google.com/maps/documentation/places/web-service/nearby-search · https://developers.google.com/maps/documentation/places/web-service/reference/rest · https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding · https://developers.google.com/maps/documentation/geocoding/reverse-geocoding · https://developers.google.com/maps/documentation/geocoding/geocoding-v4-overview · https://developers.google.com/maps/documentation/geocoding/overview · https://developers.google.com/maps/documentation/geocoding/usage-and-billing · https://developers.google.com/maps/documentation/geocoding/reference/rest · https://developers.google.com/maps/get-started

## Not verified, or the docs conflict

1. **Resolved: the Places API (New) service name.** The REST reference states "Service: places.googleapis.com". The "enable all Maps APIs" command on get-started still lists only the legacy `places-backend.googleapis.com`.
2. **Resolved: Geocoding v4 status.** The overview says v4 is generally available. The "During Preview… 25 QPS" note on start-v4 is leftover wording, but usage-and-billing confirms the 25 QPS default quota. Either v3 or v4 works for a demo.
3. **Firebase's Google access token is not refreshed or persisted after reload.** This is inferred from `OAuthCredential` having only `accessToken`, `idToken` and `secret` (confirmed). The Firebase docs never say it outright. "Firebase handles token refresh" applies to Firebase ID tokens only.
4. **The roughly 1-hour token lifetime** comes from doc examples (`expires_in=3600`). Always read `expires_in` instead.
5. **The "Advanced → Go to (unsafe)" click-through wording** is still unverified. The support page only says a warning is shown before a test user can authorize.
6. **`snippet` with `format=metadata`.** The Message resource has `snippet`, but the Format enum doesn't say it is included with `metadata`. Test it.
7. **Browser CORS on `gmail.googleapis.com`** is implied by the official browser JS quickstart, which calls the API from the page. It was not tested.
8. **The points that were from memory:**
   - **Confirmed:** setting `output: 'standalone'` together with `next start` produces a warning. Source: `packages/next/src/server/next.ts`.
   - **Confirmed, with a caveat:** the Firebase web config/apiKey is not a secret, but only for keys restricted to Firebase services.
   - **Confirmed:** the `primaryTypeDisplayName` field mask exists and bills under Nearby Search Pro.
   - **Unverified:** running `firebase-admin` locally with user ADC may need `GOOGLE_CLOUD_PROJECT` or an explicit `projectId`. The ADC docs do warn that user-credential ADC may need a quota project for some APIs.
   - **Unverified:** the exact error accounts that aren't test users get (`access_denied`).