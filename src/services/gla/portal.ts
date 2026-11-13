/**
 * Client for portal-backend (per-login session tokens).
 *
 * Endpoints:
 *   GET  /api/gla/captcha?roll=… → { attempt, imageBase64 } (same Render host as enroll)
 *   POST /api/gla/login      → { roll, password, captcha, attempt } → { sessionToken }
 *   POST /api/gla/enroll     → portal verify + Firebase custom token
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
  (import.meta.env.VITE_PORTAL_BACKEND_URL as string | undefined) ||
  'https://reminder-backend-cf51.onrender.com';

const ATTEMPT_KEY = 'gla_portal_attempt_v1';

/** Attempt id from the most recent captcha, bound to its roll (memory + sessionStorage). */
let lastAttempt: { roll: string; id: string } | null = null;

function normRoll(roll: string): string {
  return roll.trim().toUpperCase().replace(/\s+/g, '');
}

function persistAttempt(roll: string, id: string): void {
  lastAttempt = { roll: normRoll(roll), id };
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(lastAttempt));
  } catch {
    /* private mode */
  }
}

function clearAttempt(): void {
  lastAttempt = null;
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* ignore */
  }
}

function attemptFor(roll: string): string | undefined {
  const want = normRoll(roll);
  if (lastAttempt && lastAttempt.roll === want) return lastAttempt.id;
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { roll?: string; id?: string };
    if (parsed?.roll === want && parsed.id) {
      lastAttempt = { roll: parsed.roll, id: parsed.id };
      return parsed.id;
    }
  } catch {
    /* ignore */
  }
  return undefined;
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
  // Relative paths (e.g. /api/gla/captcha) need a base — bare `new URL('/…')` throws in the browser.
  const u = /^https?:\/\//i.test(url)
    ? new URL(url)
    : new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  u.searchParams.set('roll', roll.trim());
  // Keep same-origin fetches as path+query (avoid leaking absolute origin into tests)
  if (!/^https?:\/\//i.test(url)) {
    return `${u.pathname}${u.search}`;
  }
  return u.toString();
}

/**
 * Load captcha via same-origin proxy (/api/gla/captcha) so the attempt id is
 * minted on the same Render host that /api/gla/enroll and /api/gla/login use.
 */
export async function fetchCaptchaBlob(roll: string): Promise<Blob> {
  if (!roll.trim()) throw new Error('Roll number required for captcha');
  const url = withRoll('/api/gla/captcha', roll);
  const res = await fetch(url, { cache: 'no-store' });
  type CaptchaPayload = {
    success?: boolean;
    error?: string;
    attempt?: string;
    imageBase64?: string;
    contentType?: string;
  };
  let data: CaptchaPayload;
  try {
    data = await parseJson<CaptchaPayload>(res);
  } catch {
    data = { success: false, error: `Captcha failed (${res.status})` };
  }

  if (!res.ok || !data.success || !data.attempt || !data.imageBase64) {
    throw new Error(data.error || 'Failed to load captcha');
  }

  persistAttempt(roll, data.attempt);
  const binary = atob(data.imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: data.contentType || 'image/png' });
}

export async function portalLogin(
  roll: string,
  password: string,
  captcha: string
): Promise<{ success: boolean; error?: string; sessionToken?: string; expiresAt?: number }> {
  const attempt = attemptFor(roll);
  if (!attempt) {
    return { success: false, error: 'Captcha expired — load a new captcha' };
  }
  // Same-origin proxy → same PORTAL_BACKEND_URL as captcha/enroll
  const res = await fetch('/api/gla/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll, password, captcha, attempt }),
  });
  clearAttempt();
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
  const attempt = attemptFor(roll);
  if (!attempt) {
    return { success: false, error: 'Captcha expired — load a new captcha' };
  }
  const res = await fetch('/api/gla/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll, password, captcha, attempt }),
  });
  clearAttempt();
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
