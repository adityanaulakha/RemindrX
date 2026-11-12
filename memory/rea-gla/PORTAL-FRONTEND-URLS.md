# portal-frontend URL map

**Repo:** https://github.com/adityanaulakha/portal-frontend.git  
**Scanned:** 2026-10-26 (`src/App.jsx`)

## Base

```
https://portal-backend-z9ce.onrender.com
```

CORS: `Access-Control-Allow-Origin: *` (browser can call directly).

## Endpoints

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/captcha` | — | `image/png` |
| POST | `/login` | `{ roll, password, captcha }` | `{ success: true }` or `{ success: false, error }` |
| GET | `/dashboard` | session on backend | `{ summary: { overall, cpi }, subjects: [{ name, attendance }] }` or `{ error }` |
| GET | `/timetable` | session | week lecture rows (`GetTimeTableWeek`) |
| GET | `/timetable?date=` | session | day rows via portal `POST /MyAccount/GetTimeTable` `{ text: "M/D/YYYY" }` (GLA date pick). Also accepts `DD.MM.YYYY` / `YYYY-MM-DD`. |
| POST | `/logout` | — | `{ success: true, message }` |

## Dashboard subject shape

- `name` — subject label (often `"CODE-Title"`)
- `attendance` — percent number/string

## Timetable lecture fields (when present)

`LecDate` (`DD.MM.YYYY`), `LecDay`, `LecNo`, `LecType`, `LecStatus` (`Present` | `Absent` | `Pending` | `Completed`), `SuCode`, `SuName`, `LecTime`, `EmpName`, `RoomNo`, `Building`, `Mode`, `HiglightDay`

RemindrX Timetable mirrors the GLA app: **current-month calendar only**, fetches that day with `?date=`, shows Present/Absent from `LecStatus` / `PresentStatus`.

Upstream portal endpoints (scraped by portal-backend):
- `POST https://student.glauniversity.in/MyAccount/GetTimeTableWeek` — week
- `POST https://student.glauniversity.in/MyAccount/GetTimeTable` `{ text: "M/D/YYYY" }` — selected day (used by official web date picker; mobile app equivalent)

## RemindrX wiring

- Client: `src/services/gla/portal.ts`
- Session/PIN/snapshot: `src/services/gla/session.ts`
- Orchestration: `src/services/gla/client.ts`
- UI: `src/pages/Attendance.tsx`

## Notes

- Free Render service may cold-start (~30s).
- Backend appears to keep a server-side portal scrape session (frontend does not send cookies/`credentials`). Fine for personal use; multi-tenant isolation may need a per-user proxy later.
