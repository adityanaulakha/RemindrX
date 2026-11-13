/**
 * Client for portal-backend (per-login session tokens).
 *
 * Endpoints:
 *   GET  /captcha?roll=…     → PNG + X-Portal-Attempt header (one-time attempt id)
 *   POST /login              → { roll, password, captcha, attempt } → { sessionToken }
 *   POST /enroll             → via RemindrX /api/gla/enroll (server-to-server)
 *   GET  /dashboard          → Authorization: Bearer <sessionToken>
 *   GET  /timetable?date=…   → Authorization: Bearer <sessionToken>
 *   GET  /profile            → Authorization: Bearer <sessionToken>
 *   POST /logout             → Authorization: Bearer <sessionToken>
 *
 * The roll number alone never grants access; the session token does.
 * Render is keep-alive pinged ~every 14 min; fetches retry on cold-start.
 */

import { portalFetch } from './portalResilience';

export const PORTAL_BASE =
  (import.meta.env.VITE_PORTAL_BACKEND_URL as string | undefined) || 'https://portal-backend-z9ce.onrender.com';

/** Attempt id from the most recent captcha, bound to its roll. */
let lastAttempt: { roll: string; id: string } | null = null;

function normRoll(roll: string): string {
  return roll.trim().toUpperCase().replace(/\s+/g, '');
}

function attemptFor(roll: string): string | undefined {
  return lastAttempt && lastAttempt.roll === normRoll(roll) ? lastAttempt.id : undefined;
}

function authHeaders(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
  dob?: string | null;
  course?: string | null;
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
  /** portal-backend session token for Attendance / Timetable. */
  portalSession?: string;
  portalSessionExpiresAt?: number;
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
  const res = await portalFetch(withRoll(`${PORTAL_BASE}/captcha`, roll), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load captcha');
  const id = res.headers.get('X-Portal-Attempt');
  lastAttempt = id ? { roll: normRoll(roll), id } : null;
  return res.blob();
}

export async function portalLogin(
  roll: string,
  password: string,
  captcha: string
): Promise<{ success: boolean; error?: string; sessionToken?: string; expiresAt?: number }> {
  const res = await portalFetch(`${PORTAL_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll, password, captcha, attempt: attemptFor(roll) }),
  });
  lastAttempt = null;
  const data = await parseJson<{ success?: boolean; error?: string; sessionToken?: string; expiresAt?: number }>(
    res
  ).catch(() => ({ success: false, error: `Login failed (${res.status})` }) as { success?: boolean; error?: string; sessionToken?: string; expiresAt?: number });
  if (data.success && data.sessionToken) {
    return { success: true, sessionToken: data.sessionToken, expiresAt: data.expiresAt };
  }
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
    body: JSON.stringify({ roll, password, captcha, attempt: attemptFor(roll) }),
  });
  lastAttempt = null;
  const text = await res.text();
  try {
    return JSON.parse(text) as EnrollResponse;
  } catch {
    return {
      success: false,
      error: text?.trim()
        ? `Enroll failed (${res.status}): ${text.slice(0, 180)}`
        : `Enroll failed with HTTP ${res.status}`,
    };
  }
}

export async function portalDashboard(token?: string | null): Promise<PortalDashboard | null> {
  if (!token) return null;
  try {
    const res = await portalFetch(`${PORTAL_BASE}/dashboard`, { headers: authHeaders(token) });
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
  } catch {
    return null;
  }
}

export async function portalProfile(token?: string | null): Promise<PortalProfile | null> {
  if (!token) return null;
  try {
    const res = await portalFetch(`${PORTAL_BASE}/profile`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    const data = await parseJson<{ success?: boolean; profile?: PortalProfile; error?: string }>(res);
    return data.profile || null;
  } catch {
    return null;
  }
}

/** Sync Firestore user + subjects from live portal jar (requires Firebase ID token). */
export async function refreshPortalProvision(idToken: string): Promise<{
  success: boolean;
  error?: string;
  subjectUpserts?: number;
  profile?: PortalProfile;
}> {
  const res = await fetch('/api/gla/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as {
      success: boolean;
      error?: string;
      subjectUpserts?: number;
      profile?: PortalProfile;
    };
  } catch {
    return {
      success: false,
      error: text?.trim() || `Refresh failed (${res.status})`,
    };
  }
}

export async function portalTimetable(
  date?: Date | string | null,
  token?: string | null
): Promise<PortalLecture[] | Record<string, PortalLecture[]> | null> {
  if (!token) return null;
  const url = new URL(`${PORTAL_BASE}/timetable`);
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    url.searchParams.set('date', `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`);
  } else if (typeof date === 'string' && date.trim()) {
    url.searchParams.set('date', date.trim());
  }
  try {
    const res = await portalFetch(url.toString(), { headers: authHeaders(token) });
    if (!res.ok) return null;
    const data = await parseJson<{ error?: string } & (PortalLecture[] | Record<string, PortalLecture[]>)>(res);
    if (data && typeof data === 'object' && 'error' in data && data.error) return null;
    return data as PortalLecture[] | Record<string, PortalLecture[]>;
  } catch {
    return null;
  }
}

export async function portalLogout(token?: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch(`${PORTAL_BASE}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: '{}',
    });
  } catch {
    /* ignore */
  }
}
