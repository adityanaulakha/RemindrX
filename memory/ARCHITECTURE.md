# Architecture

**RemindrX** — college academic PWA (React + Firebase) for students, class reps (CR/admins), and super admins. Primary college target: **GLA University** (`gla.ac.in`).

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Firebase: Auth, Firestore (persistent multi-tab cache), Storage, Messaging
- React Router 7
- PWA: `vite-plugin-pwa` + `virtual:pwa-register`
- Deploy: Vercel SPA rewrite (`vercel.json`)
- UI: Lucide, react-hot-toast, recharts
- Email: `@emailjs/browser` (config in `src/config/email.ts`)

**Note:** README mentions Zustand; no Zustand store exists. Auth/user state is `AuthContext` only.

## Roles

| Role | How | Capabilities |
|------|-----|--------------|
| Student | `role: 'student'` | Timeline, subjects, updates, events RSVP, attendance UI, profile |
| Class admin (CR) | `role: 'admin'` + class membership | CR panel: subjects/tasks/class management |
| Super admin | `isSuperAdmin: true` | Institutes, classes, event moderation, class-change requests |

Signup requires verified institutional email against Firestore `institutes.domains`.

## Routes (`src/App.tsx`)

| Path | Page | Gate |
|------|------|------|
| `/` | Landing or redirect | public / auth |
| `/login` | Login / signup | public |
| `/join` | Join class via code | auth, no `classId` |
| `/dashboard` | Home overview | protected |
| `/subjects`, `/subjects/:id` | Subjects | protected |
| `/timeline` | Tasks + events feed | protected |
| `/events` | Campus events | protected |
| `/updates` | Class posts / intel | protected |
| `/attendance` | Bunk analytics | protected (portal currently mock) |
| `/profile` | User profile | protected |
| `/cr-panel` | CR tools | protected |
| `/super-admin` | Global admin | protected |

Protected users without `classId` (and not super admin) are forced to `/join`.

## Data model (Firestore)

Collections used in rules/types: `users`, `classes`, `subjects`, `tasks`, `posts`, `events`, `event_participations`, `class_change_requests`, `notifications`, `institutes`.

Key types: `src/types/index.ts`. Rules: `firestore.rules`.

## PWA

- Manifest in `vite.config.ts` (name still generic: "Academic Platform")
- Icons: `public/logo-mark.svg`, `public/icon-192.png`, `public/icon-512.png`
- SW: auto-update; FCM SW at `public/firebase-messaging-sw.js`
- Offline: Firestore persistent local cache

## Notable local artifact

- `com.glauniversity.main_2.4.10.xapk` at repo root — GLA University Android package (likely reference for real attendance-portal integration). Not part of the web app runtime.
