# Sessions

Append-only session log.

## 2026-10-26 — Timetable page

- Added `/timetable` page + sidebar nav; uses portal `GET /timetable`, date-wise filter via `LecDate`, Present/Absent from `LecStatus`, local cache, redirects to Attendance if not connected

## 2026-10-26 — portal-frontend integration

- Cloned/scanned https://github.com/adityanaulakha/portal-frontend.git
- BASE `https://portal-backend-z9ce.onrender.com` — `/captcha`, `/login`, `/dashboard`, `/timetable`, `/logout`
- RemindrX Attendance now uses real portal data (captcha + dashboard); local PIN + snapshot cache retained
- URL map: `memory/rea-gla/PORTAL-FRONTEND-URLS.md`

## 2026-10-26 — GLA XAPK auth persistence + PWA session layer

- Reverse-engineered `com.glauniversity.main_2.4.10` (Flutter): stay-logged-in = SharedPreferences tokens (`financeToken` / `financeRefreshToken`) + 4-digit MPIN + daily `POST …/api/v1/refresh-token` `{Token,RefreshToken}`; password not reused each launch.
- JADX not available; used libapp.so strings + live probes. CORS requires proxy.
- Implemented RemindrX session/PIN/refresh + Attendance restore UX; login endpoint still 501.
- Findings: `memory/rea-gla/FINDINGS-auth-persistence.md`.

## 2026-10-26 — Codebase review + memory bootstrap

- Connected REA; Node → 26.12.1; explored RemindrX; created `memory/`.


## 2026-10-26 — GLA-like date timetable

- RE of GLA app + Student Corner `TimeTable.js`: current-month date pick; day fetch via `/MyAccount/GetTimeTable` `{ text }`; empty copy + Present/Absent.
- Updated `.tmp-portal-backend` (`portal-backend` repo) to honor `GET /timetable?date=`.
- RemindrX Timetable: month calendar + day fetch + Present/Absent badges.

## 2026-10-26 — Present/Absent vs Completed

- Portal `LecStatus` is class lifecycle (`Pending`/`Completed`), not student mark.
- Backend enriches day timetable via `/GetOtherDetails` + subject attendance endpoints; sets `PresentStatus`.
- UI prefers Present/Absent; shows **Not marked** when only Completed is available.
