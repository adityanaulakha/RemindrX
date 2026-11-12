# Done

Newest first.

## 2026-10-26

- [x] Added Timetable page (`/timetable`) using portal `/timetable` + nav link + cache
- [x] Date-wise timetable (date chips / picker) + Present/Absent badges from `LecStatus`
- [x] GLA-parity timetable: current-month calendar, `GetTimeTable` day fetch (`?date=`), Present/Absent
- [x] Integrated portal-frontend backend URLs into RemindrX Attendance (captcha login + live dashboard)
- [x] Documented URL map in `memory/rea-gla/PORTAL-FRONTEND-URLS.md`
- [x] RE GLA XAPK: Flutter app; session = tokens + MPIN + daily refresh (not password reuse)
- [x] Confirmed refresh API body/fields; documented in `memory/rea-gla/FINDINGS-auth-persistence.md`
- [x] Implemented RemindrX GLA session store + PIN unlock + refresh proxy (`src/services/gla/*`, `api/gla/*`)
- [x] Attendance page uses session restore flow (replaces boolean localStorage mock connect)
- [x] Explored RemindrX codebase; memory folder; REA MCP install; Node → 26.12.1

