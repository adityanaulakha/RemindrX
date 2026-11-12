/**
 * Client for https://portal-backend-z9ce.onrender.com
 * Source of truth: github.com/adityanaulakha/portal-frontend (src/App.jsx)
 *
 * Endpoints:
 *   GET  /captcha     → PNG
 *   POST /login       → { roll, password, captcha } → { success } | { success:false, error }
 *   GET  /dashboard   → { summary: { overall, cpi }, subjects: [{ name, attendance }] }
 *   GET  /timetable?date=… → day (or week) lecture rows; date = M/D/YYYY | DD.MM.YYYY | YYYY-MM-DD
 *        (mirrors GLA web POST /MyAccount/GetTimeTable `{ text }` / app DateFrom pick)
 *   POST /logout      → { success: true }
 *
 * CORS: Access-Control-Allow-Origin: * (browser can call directly).
 */

export const PORTAL_BASE = 'https://portal-backend-z9ce.onrender.com';

export interface PortalSubject {
  name: string;
  attendance: string | number;
}

export interface PortalSummary {
  overall: string;
  cpi: string;
}

export interface PortalDashboard {
  summary: PortalSummary;
  subjects: PortalSubject[];
}

export interface PortalLecture {
  LecDay?: string;
  /** Portal date string, e.g. `28.10.2026` */
  LecDate?: string;
  LecNo?: string | number;
  LecType?: string;
  /** Class lifecycle from web timetable: Pending | Completed (not the same as Present/Absent). */
  LecStatus?: string;
  /** Student mark when portal provides it: Present | Absent | … */
  PresentStatus?: string;
  AttStatus?: string;
  AttendanceStatus?: string;
  StuStatus?: string;
  statusOnDate?: string;
  SuCode?: string;
  SuName?: string;
  LecTime?: string;
  EmpName?: string;
  RoomNo?: string;
  Building?: string;
  ClassType?: string;
  Mode?: string;
  HiglightDay?: string;
  InLec?: string;
  Combine?: string;
  [key: string]: unknown;
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchCaptchaBlob(): Promise<Blob> {
  const res = await fetch(`${PORTAL_BASE}/captcha`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load captcha');
  return res.blob();
}

export async function portalLogin(roll: string, password: string, captcha: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${PORTAL_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll, password, captcha }),
  });
  const data = await parseJson<{ success?: boolean; error?: string }>(res);
  if (data.success) return { success: true };
  return { success: false, error: data.error || 'Login failed' };
}

export async function portalDashboard(): Promise<PortalDashboard | null> {
  const res = await fetch(`${PORTAL_BASE}/dashboard`);
  if (!res.ok) return null;
  const data = await parseJson<PortalDashboard & { error?: string }>(res);
  if (data.error) return null;
  return {
    summary: {
      overall: data.summary?.overall ?? '--',
      cpi: data.summary?.cpi ?? '--',
    },
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
  };
}

/**
 * Fetch timetable. Pass `date` (Date or portal/ISO string) to load that day
 * the same way the GLA app/web date picker does.
 */
export async function portalTimetable(
  date?: Date | string | null
): Promise<PortalLecture[] | Record<string, PortalLecture[]> | null> {
  const url = new URL(`${PORTAL_BASE}/timetable`);
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    url.searchParams.set('date', `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`);
  } else if (typeof date === 'string' && date.trim()) {
    url.searchParams.set('date', date.trim());
  }
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await parseJson<{ error?: string } & (PortalLecture[] | Record<string, PortalLecture[]>)>(res);
  if (data && typeof data === 'object' && 'error' in data && data.error) return null;
  return data as PortalLecture[] | Record<string, PortalLecture[]>;
}

export async function portalLogout(): Promise<void> {
  try {
    await fetch(`${PORTAL_BASE}/logout`, { method: 'POST' });
  } catch {
    /* ignore */
  }
}
