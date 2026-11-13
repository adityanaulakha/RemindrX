/**
 * Shared helpers for Vercel serverless routes (Node ESM).
 * Files under api/_lib are not deployed as routes (leading underscore).
 *
 * Firebase Admin env (any one of):
 *   FIREBASE_SERVICE_ACCOUNT_JSON — full service account JSON string
 *   FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */
import { createHash } from 'node:crypto';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

export type Req = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

export type Res = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => { json: (b: unknown) => void };
};

let app: App | null = null;

function loadCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON missing client_email/private_key');
    }
    return {
      projectId: parsed.project_id,
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
      }),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    };
  }

  throw new Error(
    'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
}

export function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const { projectId, credential } = loadCredential();
  app = initializeApp({ credential, projectId });
  return app;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/** Deterministic Firebase uid per GLA roll number: repeat logins reuse it. */
export function glaUid(roll: string): string {
  const clean = String(roll || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  return `gla_${clean}`;
}

export function sha(input: string, len = 32): string {
  return createHash('sha256').update(input).digest('hex').slice(0, len);
}

export function header(req: Req, name: string): string {
  const h = req.headers || {};
  const v = h[name.toLowerCase()] ?? h[name];
  return Array.isArray(v) ? v[0] || '' : v || '';
}

export function clientIp(req: Req): string {
  const xf = header(req, 'x-forwarded-for');
  return (
    xf.split(',')[0]?.trim() ||
    header(req, 'x-real-ip') ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Headers for server-to-server calls to portal-backend. Adds X-Portal-Secret
 * when PORTAL_SHARED_SECRET is configured (required by /enroll and roll-based
 * /profile once it is set on Render).
 */
export function portalHeaders(base: Record<string, string> = {}): Record<string, string> {
  const secret = process.env.PORTAL_SHARED_SECRET;
  return secret ? { ...base, 'X-Portal-Secret': secret } : { ...base };
}

/** Render keep-alive is ~14 min; allow cold-boot headroom if a ping is missed. */
export const PORTAL_TIMEOUT_MS = 60_000;
const PORTAL_RETRY_DELAYS_MS = [0, 2_500, 6_000];

function isTransientPortalStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 521 || status === 522 || status === 524;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upstream portal fetch with retries for unexpected Render cold starts.
 * Non-transient HTTP statuses return immediately (do not burn retries on 401).
 */
export async function portalFetchRetry(
  input: string,
  init?: RequestInit,
  opts?: { retries?: number; timeoutMs?: number }
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  const timeoutMs = opts?.timeoutMs ?? PORTAL_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(PORTAL_RETRY_DELAYS_MS[Math.min(attempt, PORTAL_RETRY_DELAYS_MS.length - 1)] ?? 6_000);
    }
    try {
      const res = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok || !isTransientPortalStatus(res.status) || attempt === retries) {
        return res;
      }
      lastError = new Error(`Portal HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Portal request failed');
}

export function bodyOf<T>(req: Req): Partial<T> {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try {
      return JSON.parse(b) as Partial<T>;
    } catch {
      return {};
    }
  }
  return b as Partial<T>;
}

// ---------- CORS ----------

const STATIC_ORIGINS = [
  'https://www.remindrx.xyz',
  'https://remindrx.xyz',
  'http://localhost:5173',
  'http://localhost:4173',
];

/** Vercel preview/branch URLs for this project. */
const PREVIEW_ORIGIN =
  /^https:\/\/remindr-(x|[a-z0-9-]+-adityanaulakhas-projects)\.vercel\.app$/;

function sameOrigin(req: Req, origin: string): boolean {
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin: string, req?: Req): boolean {
  if (!origin) return false;
  if (req && sameOrigin(req, origin)) return true;
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return STATIC_ORIGINS.includes(origin) || extra.includes(origin) || PREVIEW_ORIGIN.test(origin);
}

/**
 * Restrict CORS to app origins. Same-origin requests (browsers still send
 * Origin on POST) and requests without an Origin header pass. Returns true
 * when the request was fully handled (preflight or rejected).
 */
export function applyCors(req: Req, res: Res, methods = 'POST, OPTIONS'): boolean {
  const origin = header(req, 'origin');
  res.setHeader('Vary', 'Origin');
  const allowed = !origin || isAllowedOrigin(origin, req);
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (!allowed) {
    res.status(403).json({ success: false, error: 'Origin not allowed' });
    return true;
  }
  if (req.method === 'OPTIONS') {
    res.status(204).json({});
    return true;
  }
  return false;
}

// ---------- auth ----------

export async function verifyBearer(req: Req): Promise<DecodedIdToken | null> {
  const token = header(req, 'authorization').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

// ---------- rate limiting (shared across instances via Firestore) ----------

/**
 * Fixed-window counter stored in rateLimits/{hash(key)}. Works across all
 * serverless instances. `expireAt` is a Timestamp so a Firestore TTL policy on
 * rateLimits.expireAt can garbage-collect old windows.
 * Fails open if Firestore is unavailable (logged), so an outage doesn't lock
 * every student out.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec: number }> {
  try {
    const db = adminDb();
    const ref = db.collection('rateLimits').doc(sha(key, 40));
    const now = Date.now();
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() as { windowStart?: number; count?: number }) : null;
      const fresh = !data || !data.windowStart || now - data.windowStart >= windowMs;
      const windowStart = fresh ? now : data!.windowStart!;
      const count = fresh ? 1 : (data!.count || 0) + 1;
      const retryAfterSec = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
      if (!fresh && count > max) {
        return { ok: false, retryAfterSec };
      }
      tx.set(ref, {
        windowStart,
        count,
        expireAt: Timestamp.fromMillis(windowStart + windowMs * 2),
      });
      return { ok: true, retryAfterSec };
    });
  } catch (err) {
    console.error('rateLimit store error', err instanceof Error ? err.message : err);
    return { ok: true, retryAfterSec: 0 };
  }
}

export async function enforceLimits(
  res: Res,
  limits: { key: string; max: number; windowMs: number }[]
): Promise<boolean> {
  const results = await Promise.all(limits.map((l) => rateLimit(l.key, l.max, l.windowMs)));
  for (const r of results) {
    if (!r.ok) {
      res.setHeader('Retry-After', String(r.retryAfterSec));
      res.status(429).json({
        success: false,
        error: `Too many attempts. Try again in ${Math.ceil(r.retryAfterSec / 60)} min.`,
      });
      return false;
    }
  }
  return true;
}
