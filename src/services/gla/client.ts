import {
  portalDashboard,
  portalLogin,
  portalLogout,
  portalTimetable,
  type PortalDashboard,
  type PortalLecture,
} from './portal';
import {
  clearGlaSession,
  loadMeta,
  loadSnapshot,
  markConnected,
  saveSnapshot,
  saveTimetableSnapshot,
  type GlaPortalSnapshot,
} from './session';

function activeRoll(): string | null {
  return loadMeta().roll;
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Normalize timetable API payload into LecDay → lectures[]. */
export function normalizeTimetable(
  data: PortalLecture[] | Record<string, PortalLecture[]>
): Record<string, PortalLecture[]> {
  if (Array.isArray(data)) {
    const grouped: Record<string, PortalLecture[]> = {};
    for (const lec of data) {
      const day = String(lec.LecDay || lec.Day || 'Unknown');
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(lec);
    }
    for (const day of Object.keys(grouped)) {
      grouped[day].sort((a, b) => Number(a.LecNo || 0) - Number(b.LecNo || 0));
    }
    return grouped;
  }

  const grouped: Record<string, PortalLecture[]> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue;
    grouped[key] = [...value].sort((a, b) => Number(a.LecNo || 0) - Number(b.LecNo || 0));
  }
  return grouped;
}

export function orderedTimetableDays(grouped: Record<string, PortalLecture[]>): string[] {
  const rest = Object.keys(grouped).filter((d) => !DAY_ORDER.includes(d));
  return [...DAY_ORDER.filter((d) => grouped[d]?.length), ...rest];
}

/** Flatten day-grouped timetable into a single sorted lecture list. */
export function flattenTimetable(grouped: Record<string, PortalLecture[]>): PortalLecture[] {
  const flat = Object.values(grouped).flat();
  return flat.sort((a, b) => {
    const da = parsePortalDate(String(a.LecDate || ''))?.getTime() ?? 0;
    const db = parsePortalDate(String(b.LecDate || ''))?.getTime() ?? 0;
    if (da !== db) return da - db;
    return Number(a.LecNo || 0) - Number(b.LecNo || 0);
  });
}

/** Parse portal `DD.MM.YYYY` → Date (local midnight). */
export function parsePortalDate(lecDate: string): Date | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(lecDate.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Format Date → portal `DD.MM.YYYY`. */
export function formatPortalDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function toInputDateValue(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export function fromInputDateValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Unique LecDate values present in the timetable, sorted ascending. */
export function availableTimetableDates(grouped: Record<string, PortalLecture[]>): string[] {
  const dates = new Set<string>();
  for (const lec of flattenTimetable(grouped)) {
    if (lec.LecDate) dates.add(String(lec.LecDate));
  }
  return [...dates].sort((a, b) => {
    const da = parsePortalDate(a)?.getTime() ?? 0;
    const db = parsePortalDate(b)?.getTime() ?? 0;
    return da - db;
  });
}

/** Lectures for a portal date string (`DD.MM.YYYY`), sorted by LecNo. */
export function lecturesForDate(
  grouped: Record<string, PortalLecture[]>,
  portalDate: string
): PortalLecture[] {
  return flattenTimetable(grouped)
    .filter((lec) => String(lec.LecDate || '') === portalDate)
    .sort((a, b) => Number(a.LecNo || 0) - Number(b.LecNo || 0));
}

/** Pick best default date: today if present, else highlight day, else first available. */
export function defaultTimetableDate(grouped: Record<string, PortalLecture[]>): string | null {
  const dates = availableTimetableDates(grouped);
  if (dates.length === 0) return null;
  const today = formatPortalDate(new Date());
  if (dates.includes(today)) return today;
  for (const lec of flattenTimetable(grouped)) {
    if (String(lec.HiglightDay || '').toLowerCase() === 'yes' && lec.LecDate) {
      return String(lec.LecDate);
    }
  }
  return dates[0];
}

/** Normalize LecStatus / PresentStatus into attendance label + tone. */
export function attendanceFromStatus(status?: string): {
  label: string;
  tone: 'present' | 'absent' | 'pending' | 'completed' | 'other';
} {
  const raw = (status || '').trim();
  const s = raw.toLowerCase();
  if (!raw) return { label: 'Unknown', tone: 'other' };
  if (s === 'present' || s === 'p' || s.includes('present')) return { label: 'Present', tone: 'present' };
  if (s === 'absent' || s === 'a' || s.includes('absent')) return { label: 'Absent', tone: 'absent' };
  if (s === 'pending' || (s.includes('pending') && !s.includes('not'))) {
    return { label: 'Pending', tone: 'pending' };
  }
  // Web portal GetTimeTable uses Completed = class held, not student Present/Absent
  if (s === 'completed' || s.includes('completed') || s === 'held' || s.includes('not marked') || s === 'notmarked') {
    return { label: 'Not marked', tone: 'completed' };
  }
  return { label: raw, tone: 'other' };
}

/**
 * Prefer explicit attendance mark (Present/Absent) over class LecStatus (Pending/Completed).
 * Portal web timetable often only sends Completed/Pending; PresentStatus is filled when available.
 */
export function lectureAttendanceStatus(lec: PortalLecture): string | undefined {
  const candidates = [
    lec.PresentStatus,
    lec.AttStatus,
    lec.AttendanceStatus,
    lec.StuStatus,
    lec.statusOnDate,
  ];
  for (const c of candidates) {
    if (c == null || String(c).trim() === '') continue;
    const s = String(c).trim().toLowerCase();
    if (s === 'present' || s === 'p' || s.includes('present')) return 'Present';
    if (s === 'absent' || s === 'a' || s.includes('absent')) return 'Absent';
    if (s.includes('not marked') || s === 'notmarked') return 'Not marked';
    if (s === 'pending' || s.includes('pending')) return 'Pending';
    return String(c).trim();
  }

  const lecStatus = lec.LecStatus != null ? String(lec.LecStatus).trim() : '';
  const ls = lecStatus.toLowerCase();
  if (ls === 'present' || ls.includes('present')) return 'Present';
  if (ls === 'absent' || ls.includes('absent')) return 'Absent';
  if (ls === 'pending' || ls.includes('pending')) return 'Pending';
  if (ls === 'completed' || ls.includes('completed')) {
    // Class was held but student Present/Absent not in timetable row
    return 'Not marked';
  }
  return lecStatus || undefined;
}

/** GLA app rule: timetable date pick is limited to the current calendar month. */
export function isDateInCurrentMonth(date: Date, now = new Date()): boolean {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Merge incoming lectures into an existing day-grouped cache (replace by LecDate). */
export function mergeTimetableLectures(
  existing: Record<string, PortalLecture[]>,
  incoming: PortalLecture[] | Record<string, PortalLecture[]>
): Record<string, PortalLecture[]> {
  const nextGrouped = normalizeTimetable(incoming);
  const incomingFlat = flattenTimetable(nextGrouped);
  const incomingDates = new Set(incomingFlat.map((l) => String(l.LecDate || '')).filter(Boolean));
  const kept = flattenTimetable(existing).filter((lec) => {
    const key = String(lec.LecDate || '');
    return !(key && incomingDates.has(key));
  });
  return normalizeTimetable([...kept, ...incomingFlat]);
}

/** Try restore live portal session; fall back to last cached snapshot. */
export async function restorePortalSession(): Promise<{
  live: boolean;
  dashboard: PortalDashboard | null;
  snapshot: GlaPortalSnapshot | null;
}> {
  const snapshot = loadSnapshot();
  const roll = activeRoll();
  if (!roll) return { live: false, dashboard: null, snapshot };
  try {
    const dashboard = await portalDashboard(roll);
    if (dashboard) {
      saveSnapshot(dashboard);
      return { live: true, dashboard, snapshot };
    }
  } catch {
    /* network / cold start */
  }
  return { live: false, dashboard: null, snapshot };
}

export async function loginAndFetch(
  roll: string,
  password: string,
  captcha: string
): Promise<{ ok: true; dashboard: PortalDashboard } | { ok: false; error: string }> {
  const cleaned = roll.trim();
  const result = await portalLogin(cleaned, password, captcha.trim());
  if (!result.success) {
    return { ok: false, error: result.error || 'Login failed' };
  }
  markConnected(cleaned);
  const dashboard = await portalDashboard(cleaned);
  if (!dashboard) {
    return { ok: false, error: 'Login succeeded but dashboard could not be loaded' };
  }
  saveSnapshot(dashboard);
  return { ok: true, dashboard };
}

export async function refreshDashboard(): Promise<PortalDashboard | null> {
  const roll = activeRoll();
  if (!roll) return null;
  const dashboard = await portalDashboard(roll);
  if (dashboard) saveSnapshot(dashboard);
  return dashboard;
}

export async function fetchTimetable(date?: Date | string | null): Promise<Record<string, PortalLecture[]> | null> {
  const raw = await portalTimetable(date ?? null, activeRoll());
  if (!raw) return null;
  const grouped = normalizeTimetable(raw);
  saveTimetableSnapshot(grouped);
  return grouped;
}

/**
 * Fetch schedule for one calendar day (GLA date-pick behaviour) and merge into cache.
 * When the upstream only returns a week blob, that day's rows are still filtered client-side.
 */
export async function fetchTimetableForDate(
  date: Date,
  existing?: Record<string, PortalLecture[]> | null
): Promise<{ grouped: Record<string, PortalLecture[]>; day: PortalLecture[] } | null> {
  const raw = await portalTimetable(date, activeRoll());
  if (!raw) return null;
  const merged = mergeTimetableLectures(existing || {}, raw);
  saveTimetableSnapshot(merged);
  const portalDate = formatPortalDate(date);
  const day = lecturesForDate(merged, portalDate);
  return { grouped: merged, day };
}

export async function disconnectPortal(): Promise<void> {
  await portalLogout(activeRoll());
  clearGlaSession();
}
