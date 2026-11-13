# Todo

Prioritized backlog. Move completed items to `DONE.md`.

## Now

- [ ] Harden multi-user portal sessions (per-user proxy) if needed for class-wide deploy

## High (known product gaps)

- [x] Configure FCM VAPID key and persist tokens (`VITE_FIREBASE_VAPID_KEY` in `.env.local` + Vercel; `useNotifications.tsx`)
- [ ] Tighten Firestore rules (especially `classes` update, `tasks`/`posts` read/update)


## Medium

- [ ] Align README with reality (remove/clarify Zustand claim; document actual state)
- [ ] Rebrand PWA manifest (`vite.config.ts`: name/short_name currently "Academic Platform")
- [ ] Decide fate of root `com.glauniversity.main_2.4.10.xapk` (reference only vs analyze with REA)
- [ ] Confirm EmailJS config is production-ready (`src/config/email.ts`)

## Low / polish

- [ ] Consider adding `memory/` update habit to agent workflow for this repo
- [ ] Review whether `zustand` dependency should be used or removed
- [ ] Add `.env.example` if missing (do not commit secrets)
