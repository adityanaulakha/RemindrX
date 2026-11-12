# Decisions

Append-only. Format: date · decision · why · consequences.

## 2026-10-26 — Use `memory/` for agent/human project state

- **Decision:** Keep a root `memory/` folder with STATUS / DONE / TODO / ISSUES / DECISIONS / SESSIONS / ARCHITECTURE.
- **Why:** Persist context across chats; avoid re-discovering architecture and open gaps.
- **Consequences:** Agents should update these files when finishing work. Do not put secrets here.

## 2026-10-26 — Skip REA for normal source analysis

- **Decision:** Treat RemindrX source exploration as ordinary repo analysis (no REA). Reserve REA for shipped binaries/packages (e.g. GLA XAPK) when reverse-engineering is required.
- **Why:** REA skill guidance; source is available in-repo.
- **Consequences:** Use REA only when user asks to inspect the XAPK or other closed artifacts.

## 2026-10-26 — Mirror GLA token+MPIN persistence (not password storage)

- **Decision:** RemindrX stores GLA access/refresh tokens + optional local 4-digit PIN; never persist portal password. Refresh via same-origin proxy.
- **Why:** Matches official app security model discovered in RE; CORS blocks direct browser calls.
- **Consequences:** Need working first-login once; then silent reopen. Prefer moving refresh tokens server-side later for XSS resistance.

