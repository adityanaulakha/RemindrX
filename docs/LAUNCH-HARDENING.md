# Launch hardening — what changed and how to run the bottlenecks

_Branch `fix/launch-hardening`, Nov 2026._

## Identity model (unchanged, now explicit)

Students never create an account. `/api/gla/enroll` forwards roll + password +
captcha to the GLA portal once (via portal-backend), and on success mints a
Firebase **custom token** for the deterministic uid `gla_{ROLL}`. The Firebase
user is only an internal identity for Firestore rules; repeat logins reuse the
same uid. The GLA password is never stored or logged (checked in tests).

## Security fixes

| Area | Before | After |
| --- | --- | --- |
| `users` | Any signed-in user could read every profile and set `isSuperAdmin`/`role`/`classId` on their own doc | Read own doc only (super admin: all). Self-update limited to `email, deadlinePreference, fcmTokens, lastActive, photoURL` (+ `name, dob, rollNo` for non-portal staff). Role/class/admin/trust fields are server-owned |
| `classes` | Every user could read every class incl. `adminInviteCode`/`joinCode`; classmates could write `admins`/`adminCodeUses` | Read own class only. Codes moved to `classSecrets/{classId}` (CRs of that class + super admin). Writes: super admin / server only |
| CR promotion | Client-side check of the invite code, then client writes `role: 'admin'` | `POST /api/class/cr {action:'redeem'}` — Admin SDK transaction, timing-safe compare, uses/expiry, rate-limited (5/15 min per user) |
| CR demotion | Client wrote another user's doc (silently failed under old rules) | `POST /api/class/cr {action:'demote'}` |
| CR roster + trust | N per-student queries from the browser; trust score written by the client | `POST /api/class/cr {action:'roster'}` — one users query (minimal fields) + one posts query; trust scores computed and persisted server-side |
| `posts` | Any classmate could edit any field of any post | Creator edits content (resets verification). Classmates may only toggle **their own** uid in confirmations/disputes; `verified` needs a CR or ≥3 confirmations with 0 disputes |
| `events` | Anyone could read pending events, create pre-approved events, set any `goingCount` | Read approved or own; create only `pending`; RSVP counter ±1 only |
| `event_participations` | Readable by everyone | Owner, event creator, super admin |
| `notifications` | CRs could notify any user anywhere | CR broadcast only to users in the CR's own class |
| `subjects` | Super admin delete always failed (`allow delete: if false`) | Super admin can delete; CRs soft-delete (`isActive=false`) |
| `tasks` | Classmates could rewrite `completedBy` for others | Only add/remove own uid |
| API CORS | `/api/gla/refresh` sent `Access-Control-Allow-Origin: *` | All API routes: same-origin requests, remindrx.xyz, www, `remindr-*.vercel.app` previews, localhost (+ `ALLOWED_ORIGINS` env) |

Rules are covered by `tests/rules/firestore.rules.test.mjs` (60 checks) and the
API handlers by `tests/rules/api.test.mjs` (27 checks) — both run against local
emulators only.

## Bottlenecks and how to manage each

### 1. Firestore read quota (free: 50,000 reads/day)
* **Fixed:** every list query is now windowed + limited (Dashboard tasks: last 14 days → future, ≤100; events: from yesterday, ≤30; Timeline: −30 → +180 days, ≤200/≤100; Updates: last 30 days, ≤100; reminders ≤20; Super Admin lists ≤200/300 with `getCountFromServer` totals). Pages no longer refetch every time the user's profile doc changes. CR panel no longer does one posts query per student.
* **Per student session** (Dashboard + Timeline + Updates, mature semester, 60-student section): about **150–260 reads**, and it **stops growing** over the semester. Before, Dashboard/Timeline read *every* task and event ever created, so cost climbed every week.
* **Estimated DAU on the free quota:** ~200–300 active students/day (≈170 reads per active student per day, plus ~12 reads per login on the server).
* **Blaze cost:** $0.03 per 100,000 reads beyond the free 50k/day (us-central1 list price; check your DB's region) — https://cloud.google.com/firestore/pricing. Example: 2,000 DAU × 200 reads = 400k/day → 350k billable → **≈$0.11/day (~$3.2/month)**. Writes: $0.09/100k after 20k/day free.
* **Next step if needed:** serve the campus-wide approved-events list from one cached API response (`Cache-Control: s-maxage=300`) instead of every student reading the same event docs.

### 2. Render portal service (`portal-backend`)
* **Current host:** `https://reminder-backend-cf51.onrender.com` (replaces Oregon `portal-backend-z9ce`). Prefer **Singapore + Starter** so India RTT is low and the instance does not free-spin-down.
* **Keep-alive:** a self-ping every **14 minutes** usually prevents idle spin-down on Free. RemindrX retries portal calls; warm path uses a **12s** timeout, cold path **60s** with backoff.
* Sessions (cookie jars / tokens) are kept **in memory**, so a real process restart still clears live portal sessions — students keep cached Attendance and reconnect once. Fresh local snapshots (&lt;15 min) skip `/dashboard` until Refresh.
* **Next:** Move the session store to Render Key Value if you want sessions to survive deploys; add per-roll dashboard scrape cache + GLA concurrency limit in portal-backend.
* **Security (must fix in the portal-backend repo, not in this PR):** `/profile`, `/dashboard`, `/timetable`, `/debug-home`, `/logout` take only `?roll=` with `cors()` open to every origin. Anyone who knows a roll number can read that student's attendance/CPI/profile while their session is alive, or log them out. Fix: return an opaque session token from `/enroll`/`/login` and require it on every call (or require a signed token minted by `/api/gla/*` after verifying the Firebase ID token), restrict CORS to the app origins, and remove `/debug-home`.

### 3. GLA portal throughput
* GLA publishes no rate limits; each login is captcha + credential POST + several page scrapes.
* **In place:** Vercel→portal calls time out at 45 s with a clear "portal is waking/slow" error; `/enroll` is rate limited per roll (10/15 min) and per IP (300/15 min — generous because a whole campus can share one NAT IP).
* **Recommended in portal-backend:** a small concurrency limiter (e.g. `p-limit` 4–8 concurrent GLA sessions) with a queue + exponential backoff (1s, 2s, 4s, max 3 tries) on 5xx/timeouts; cache `/dashboard` attendance per roll for 10–15 min (attendance changes at most a few times a day) so reopening the app doesn't re-scrape GLA.

### 4. Vercel Hobby on a shared team
* Hobby is for personal, non-commercial use and its limits are shared with your other projects — https://vercel.com/docs/plans/hobby.
* **Recommendation:** for a public launch, move RemindrX to its own team on **Pro, $20/month** (includes $20 usage credit) — https://vercel.com/pricing. This PR has 5 API routes (enroll, login, refresh, refresh-token, class/cr).

### 5. Auth account creation cap
* Firebase lists "New account creation: 100 accounts/hour for each IP address" — https://firebase.google.com/docs/auth/limits. That limit is for client sign-ups; students here never sign up from the browser.
* **Now:** uid is deterministic (`gla_{ROLL}`); the server only *tries* `createUser` on a student's first login and ignores failures, because `signInWithCustomToken` creates the Auth user on first sign-in anyway. Repeat logins never create anything. Custom-token sign-ins are limited to 45,000/minute per project.
* **Launch-day safety:** the console lets you schedule a temporary increase to the account-creation limit (Authentication → Settings). If the project was upgraded to *Identity Platform* on Spark, note its 3,000 DAU/day cap — upgrading to Blaze removes it.

### 6. Backups / monitoring
* Enable Blaze, then **Firestore scheduled backups** (daily, 7-day retention) and **PITR** (Console → Firestore → Disaster recovery). Neither is available on the free plan.
* Set a **GCP budget alert** (e.g. $5/month) — requests are not blocked when you exceed it.
* Turn on Vercel **Observability/Logs** and a free uptime check (e.g. UptimeRobot every 5 min) on `https://reminder-backend-cf51.onrender.com/health` and `https://www.remindrx.xyz`.
* Add a TTL policy on `rateLimits.expireAt` (declared in `firestore.indexes.json`; `firebase deploy --only firestore:indexes` applies it) so old rate-limit docs delete themselves.

## Manual steps before/at launch (Aditya)
1. `node --env-file=.env.local scripts/migrate-class-secrets.mjs` (dry run), then `--apply` — moves invite codes off class docs.
2. Deploy rules + indexes: `firebase deploy --only firestore:rules,firestore:indexes` (or `scripts/deploy-firestore-rules.mjs` for rules). Wait for indexes to finish building (Console → Firestore → Indexes) before announcing.
3. Firebase: upgrade to Blaze, enable backups/PITR, budget alert; optionally schedule a temporary account-creation increase for launch day.
4. Render: portal-backend → Starter ($7) in Singapore; apply the session-token fix in portal-backend.
5. Vercel: move to a Pro team before a commercial launch.

## portal-backend session tokens (ships with this PR)

portal-backend (adityanaulakha/portal-backend, branch `fix/session-tokens`) no longer keys sessions by roll:

- `GET /captcha?roll=` returns `X-Portal-Attempt` (one-time, unguessable, bound to the roll). Loading a captcha no longer wipes another device's live session.
- `/login` and `/enroll` turn the attempt into a `ps_…` session token. `/api/gla/enroll` passes it back to the browser as `portalSession`; the app keeps it in `gla_portal_meta_v2.token`.
- `/dashboard`, `/timetable`, `/profile`, `/logout` need `Authorization: Bearer <token>`; bare `?roll=` → 401.
- `/enroll` and roll-based `/profile` (used by `/api/gla/refresh`) need `X-Portal-Secret` = `PORTAL_SHARED_SECRET`, set on both Render and Vercel.
- CORS allowlist; `/debug-home` only with `ENABLE_DEBUG_ROUTES=1`.

After deploy, students with an older Attendance session see their cached snapshot and reconnect once (captcha + password) to get a token.
