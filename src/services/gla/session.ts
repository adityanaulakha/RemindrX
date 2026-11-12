import type { PortalDashboard, PortalLecture, PortalSubject, PortalSummary } from './portal';

const META_KEY = 'gla_portal_meta_v2';
const SNAPSHOT_KEY = 'gla_portal_snapshot_v2';
const TIMETABLE_KEY = 'gla_portal_timetable_v2';
const PIN_HASH_KEY = 'gla_portal_pin_hash_v2';
const UNLOCKED_KEY = 'gla_portal_unlocked_v2';

export interface GlaPortalMeta {
  roll: string | null;
  connectedAt: number | null;
}

export interface GlaPortalSnapshot {
  summary: PortalSummary;
  subjects: PortalSubject[];
  savedAt: number;
}

export function loadMeta(): GlaPortalMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { roll: null, connectedAt: null };
    return JSON.parse(raw) as GlaPortalMeta;
  } catch {
    return { roll: null, connectedAt: null };
  }
}

export function saveMeta(meta: GlaPortalMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function loadSnapshot(): GlaPortalSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GlaPortalSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(dashboard: PortalDashboard): GlaPortalSnapshot {
  const snap: GlaPortalSnapshot = {
    summary: dashboard.summary,
    subjects: dashboard.subjects,
    savedAt: Date.now(),
  };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  return snap;
}

export interface GlaTimetableSnapshot {
  grouped: Record<string, PortalLecture[]>;
  savedAt: number;
}

export function loadTimetableSnapshot(): GlaTimetableSnapshot | null {
  try {
    const raw = localStorage.getItem(TIMETABLE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GlaTimetableSnapshot;
  } catch {
    return null;
  }
}

export function saveTimetableSnapshot(grouped: Record<string, PortalLecture[]>): GlaTimetableSnapshot {
  const snap: GlaTimetableSnapshot = { grouped, savedAt: Date.now() };
  localStorage.setItem(TIMETABLE_KEY, JSON.stringify(snap));
  return snap;
}

export function clearGlaSession(): void {
  localStorage.removeItem(META_KEY);
  localStorage.removeItem(SNAPSHOT_KEY);
  localStorage.removeItem(TIMETABLE_KEY);
  localStorage.removeItem(PIN_HASH_KEY);
  sessionStorage.removeItem(UNLOCKED_KEY);
}

export function markConnected(roll: string): void {
  saveMeta({ roll, connectedAt: Date.now() });
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Local 4-digit PIN — unlocks RemindrX UI without re-entering portal password (when backend session still alive). */
export async function setLocalPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
  const hash = await sha256Hex(`remindrx-gla-pin:${pin}`);
  localStorage.setItem(PIN_HASH_KEY, hash);
  sessionStorage.setItem(UNLOCKED_KEY, '1');
}

export function hasLocalPin(): boolean {
  return Boolean(localStorage.getItem(PIN_HASH_KEY));
}

export async function verifyLocalPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  const hash = await sha256Hex(`remindrx-gla-pin:${pin}`);
  const ok = hash === stored;
  if (ok) sessionStorage.setItem(UNLOCKED_KEY, '1');
  return ok;
}

export function isSessionUnlocked(): boolean {
  if (!hasLocalPin()) return true;
  return sessionStorage.getItem(UNLOCKED_KEY) === '1';
}

export function lockSession(): void {
  sessionStorage.removeItem(UNLOCKED_KEY);
}
