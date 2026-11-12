# Issues

Severity: `blocker` | `high` | `medium` | `low` | `info`

## Open

### ATT-001 — Portal backend may be single-tenant
- **Severity:** medium
- **Where:** `https://portal-backend-z9ce.onrender.com`
- **Detail:** portal-frontend calls without cookies/`credentials`. Shared Render process may only hold one scraped portal session. OK for personal use; risky if many students hit one backend.

### ATT-002 — Render cold starts
- **Severity:** low
- **Detail:** Free tier sleeps; captcha/login can take ~30s on first hit.


### FCM-001 — Push notifications incomplete
- **Severity:** high
- **Where:** `src/hooks/useNotifications.tsx` (`VAPID_KEY` placeholder); `src/context/AuthContext.tsx` (permission only, no `getToken`)
- **Detail:** Users may grant permission without a usable FCM registration.

### SEC-001 — Loose Firestore writes
- **Severity:** high
- **Where:** `firestore.rules`
- **Detail:**
  - `classes` allow update for any authenticated user
  - `tasks`/`posts` reads are broad; posts update unrestricted for any auth user
  - Comments in rules admit simplification vs intended class scoping

### DOC-001 — README drift
- **Severity:** low
- **Where:** `README.md` vs `package.json` / `src/`
- **Detail:** Claims Zustand global store; codebase uses `AuthContext` only. Zustand is a dependency but unused.

### PWA-001 — Generic manifest branding
- **Severity:** low
- **Where:** `vite.config.ts`
- **Detail:** `name: 'Academic Platform'`, `short_name: 'Academic'` — not RemindrX.

### DEP-001 — Large binary in repo
- **Severity:** info
- **Where:** `com.glauniversity.main_2.4.10.xapk` (~117MB)
- **Detail:** Inflates clone size; consider git-lfs, `.gitignore`, or external storage if not required in-repo.

## Fixed

_(none yet in memory log)_
