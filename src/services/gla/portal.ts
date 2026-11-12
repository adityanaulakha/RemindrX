/**
 * Client for portal-backend (per-roll cookie sessions).
 *
 * Endpoints:
 *   GET  /captcha?roll=…     → PNG
 *   POST /login              → { roll, password, captcha }
 *   POST /enroll             → login + profile (used via RemindrX /api/gla/enroll)
 *   GET  /dashboard?roll=…   → summary + subjects
 *   GET  /timetable?roll=…&date=…
 *   GET  /profile?roll=…
 *   POST /logout             → { roll }
 */

export const PORTAL_BASE = 'https://portal-backend-z9ce.onrender.com';

export interface PortalSubject {
  name: string;
  attendance: string | number;
  code?: string | null;
  present?: string | number | null;
  absent?: string | number | null;
  held?: string | number | null;
  type?: string | null;
}

export interface PortalSummary {
  overall: string;
  cpi: string;
}

export interface PortalDashboard {
  summary: PortalSummary;
  subjects: PortalSubject[];
}

export interface PortalProfile {
  roll: string;
  name: string;
  program?: string | null;
  branch?: string | null;
  year?: string | null;
  section?: string | null;
  semester?: string | null;
  portalCohortKey?: string;
  classDisplayName?: string;
  subjects?: PortalSubject[];
  summary?: PortalSummary;
}

export interface PortalLecture {
  LecDay?: string;
  LecDate?: string;
  LecNo?: string | number;
  LecType?: string;
  LecStatus?: string;
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

export interface EnrollResponse {
  success: boolean;
  error?: string;
  customToken?: string;
  uid?: string;
  classId?: string;
  classCreated?: boolean;
  subjectUpserts?: number;
  profile?: PortalProfile;
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function withRoll(url: string, roll?: string | null): string {
  if (!roll) return url;
  const u = new URL(url);
  u.searchParams.set('roll', roll.trim());
  return u.toString();
}

export async function fetchCaptchaBlob(roll: string): Promise<Blob> {
  if (!roll.trim()) throw new Error('Roll number required for captcha');
  const res = await fetch(withRoll(`${PORTAL_BASE}/captcha`, roll), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load captcha');
  return res.blob();
}

export async function portalLogin(
  roll: string,
  password: string,
  captcha: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${PORTAL_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll, password, captcha }),
  });
  const data = await parseJson<{ success?: boolean; error?: string }>(res);
  if (data.success) return { success: true };
  return { success: false, error: data.error || 'Login failed' };
}

/** RemindrX trusted enroll: portal verify + Firebase custom token + class provision */
export async function portalEnroll(
  roll: string,
  password: string,
  captcha: string
): Promise<EnrollResponse> {
  const res = await fetch('/api/gla/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll, password, captcha }),
  });
  return parseJson<EnrollResponse>(res);
}

export async function portalDashboard(roll?: string | null): Promise<PortalDashboard | null> {
  const metaRoll = roll;
  const res = await fetch(withRoll(`${PORTAL_BASE}/dashboard`, metaRoll));
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

export async function portalProfile(roll: string): Promise<PortalProfile | null> {
  const res = await fetch(withRoll(`${PORTAL_BASE}/profile`, roll));
  if (!res.ok) return null;
  const data = await parseJson<{ success?: boolean; profile?: PortalProfile; error?: string }>(res);
  return data.profile || null;
}

export async function portalTimetable(
  date?: Date | string | null,
  roll?: string | null
): Promise<PortalLecture[] | Record<string, PortalLecture[]> | null> {
  const url = new URL(`${PORTAL_BASE}/timetable`);
  if (roll) url.searchParams.set('roll', roll.trim());
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

export async function portalLogout(roll?: string | null): Promise<void> {
  try {
    await fetch(`${PORTAL_BASE}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll: roll || undefined }),
    });
  } catch {
    /* ignore */
  }
}
