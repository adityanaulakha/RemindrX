# RemindrX Memory

Working memory for agents and humans. Keep entries short, dated, and actionable.

## How to use

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | What the app is and how it is structured |
| [STATUS.md](./STATUS.md) | Current snapshot (read this first each session) |
| [DONE.md](./DONE.md) | Completed work log (newest first) |
| [TODO.md](./TODO.md) | Backlog / next actions |
| [ISSUES.md](./ISSUES.md) | Bugs, gaps, tech debt, security notes |
| [DECISIONS.md](./DECISIONS.md) | Decisions and why (append-only) |
| [SESSIONS.md](./SESSIONS.md) | Session notes (append-only) |

## Update rules

1. At session start: read `STATUS.md`, then relevant files.
2. When finishing work: move items `TODO` → `DONE`, update `STATUS`, append `SESSIONS`.
3. When finding a bug/gap: add to `ISSUES` with severity and file path.
4. Prefer bullets over essays. Link file paths. Date entries (`YYYY-MM-DD`).
5. Do not store secrets, API keys, or student credentials here.
