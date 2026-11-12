# Status

**Updated:** 2026-10-26

## Snapshot

RemindrX Attendance is wired to **portal-backend-z9ce.onrender.com** (from portal-frontend): captcha login → live `/dashboard` attendance + CPI. Local PIN unlock + cached snapshot for reopen UX.

## Working

- GLA portal connect with roll + password + captcha
- Live subject % + overall + CPI from `/dashboard`
- Session restore attempt via `/dashboard`; snapshot cache in localStorage
- Optional 4-digit local PIN gate

## Incomplete / caveats

- Portal backend may be single shared server session (Render free tier)
- Cold starts on Render
- FCM / Firestore rules / README Zustand drift still open

## Next

- Per-user session proxy if multiple students share one deployment
