/**
 * Merge a richer /profile scrape into the enroll payload.
 * New portal-backend requires Authorization: Bearer <ps_…> for /profile.
 */
import { portalFetchRetry } from './server.js';
import type { PortalProfileIn } from './portalProvision.js';

function isPlaceholderName(name: unknown): boolean {
  const s = String(name || '').trim();
  return !s || /^student\s+\d+/i.test(s) || /^gla[_\s-]*\d+/i.test(s);
}

function pickName(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s && !isPlaceholderName(s)) return s;
  }
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s) return s;
  }
  return 'Student';
}

function pickStr(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s && s !== '—' && s !== '-' && s.toLowerCase() !== 'null') return s;
  }
  return null;
}

/** Reject DOBs that are clearly "today" scrape bugs (ISO or DD/MM/YYYY). */
function pickDob(...candidates: unknown[]): string | null {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayDmy = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (!s) continue;
    if (s === todayIso || s === todayDmy) continue;
    // Also skip if parsed date is today
    const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      if (d === today.getDate() && mo === today.getMonth() + 1 && y === today.getFullYear()) continue;
    }
    return s;
  }
  return null;
}

function normalizeProfilePayload(raw: unknown): Partial<PortalProfileIn> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nested = o.profile && typeof o.profile === 'object' ? (o.profile as Record<string, unknown>) : o;
  return {
    roll: pickStr(nested.roll, nested.rollNo, nested.RollNo) || undefined,
    name: pickStr(nested.name, nested.Name, nested.studentName) || undefined,
    dob: pickDob(nested.dob, nested.DOB, nested.dateOfBirth),
    course: pickStr(nested.course, nested.Course),
    program: pickStr(nested.program, nested.Program, nested.course, nested.Course),
    branch: pickStr(nested.branch, nested.Branch, nested.stream),
    year: pickStr(nested.year, nested.Year, nested.academicYear),
    section: pickStr(nested.section, nested.Section, nested.sec),
    semester: pickStr(nested.semester, nested.Semester, nested.sem),
    subjects: Array.isArray(nested.subjects) ? (nested.subjects as PortalProfileIn['subjects']) : undefined,
    summary:
      nested.summary && typeof nested.summary === 'object'
        ? (nested.summary as PortalProfileIn['summary'])
        : undefined,
  };
}

export function mergePortalProfiles(base: PortalProfileIn, extra: Partial<PortalProfileIn> | null): PortalProfileIn {
  if (!extra) return base;
  return {
    ...base,
    roll: pickStr(extra.roll, base.roll) || base.roll,
    name: pickName(extra.name, base.name),
    dob: pickDob(extra.dob, base.dob) || base.dob || null,
    course: pickStr(extra.course, base.course, extra.program, base.program),
    program: pickStr(extra.program, base.program, extra.course, base.course),
    branch: pickStr(extra.branch, base.branch),
    year: pickStr(extra.year, base.year),
    section: pickStr(extra.section, base.section),
    semester: pickStr(extra.semester, base.semester),
    subjects:
      extra.subjects && extra.subjects.length > (base.subjects?.length || 0)
        ? extra.subjects
        : base.subjects,
    summary: extra.summary || base.summary,
  };
}

export async function fetchPortalProfileWithSession(
  portalBase: string,
  sessionToken: string
): Promise<Partial<PortalProfileIn> | null> {
  const res = await portalFetchRetry(
    `${portalBase}/profile`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
    },
    { retries: 1, timeoutMs: 45_000 }
  );
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return normalizeProfilePayload(body);
}

export async function enrichProfileWithSession(
  portalBase: string,
  sessionToken: string | undefined | null,
  base: PortalProfileIn
): Promise<PortalProfileIn> {
  if (!sessionToken) return { ...base, name: pickName(base.name) };
  try {
    const extra = await fetchPortalProfileWithSession(portalBase, sessionToken);
    return mergePortalProfiles({ ...base, name: pickName(base.name) }, extra);
  } catch {
    return { ...base, name: pickName(base.name) };
  }
}

export function profileLooksThin(profile: PortalProfileIn): boolean {
  return (
    isPlaceholderName(profile.name) ||
    (!profile.program && !profile.course) ||
    !profile.branch ||
    !profile.section
  );
}
