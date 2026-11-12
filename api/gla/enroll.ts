/**
 * Portal-first student enroll:
 * 1) Verify GLA credentials via portal-backend /enroll
 * 2) Mint Firebase custom token uid=gla_{ROLL}
 * 3) Ensure class by portalCohortKey + sync subjects
 * 4) Upsert users/{uid}
 *
 * Never stores portal password.
 */
import { adminAuth, adminDb, glaUid } from '../_lib/firebaseAdmin';
import {
  ensurePortalClassAndSubjects,
  upsertPortalUser,
  type PortalProfileIn,
} from '../_lib/portalProvision';

const PORTAL_BASE =
  process.env.PORTAL_BACKEND_URL || 'https://portal-backend-z9ce.onrender.com';

type Req = {
  method?: string;
  body?: { roll?: string; password?: string; captcha?: string };
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => { json: (b: unknown) => void };
};

const hits = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX = 25;

function rateLimit(req: Req, roll: string): string | null {
  const xf = req.headers?.['x-forwarded-for'];
  const ip = (Array.isArray(xf) ? xf[0] : xf)?.split(',')[0]?.trim() || 'unknown';
  const key = `${ip}|${roll || 'noroll'}`;
  const now = Date.now();
  let entry = hits.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0 };
    hits.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > MAX) return 'Too many enroll attempts. Try again later.';
  return null;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const roll = String(req.body?.roll || '').trim();
  const password = String(req.body?.password || '');
  const captcha = String(req.body?.captcha || '').trim();
  if (!roll || !password || !captcha) {
    return res.status(400).json({ success: false, error: 'roll, password, and captcha are required' });
  }

  const limited = rateLimit(req, roll.toUpperCase());
  if (limited) return res.status(429).json({ success: false, error: limited });

  try {
    const upstream = await fetch(`${PORTAL_BASE}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll, password, captcha }),
    });
    const portalJson = (await upstream.json()) as {
      success?: boolean;
      error?: string;
      roll?: string;
      profile?: PortalProfileIn;
    };

    if (!upstream.ok || !portalJson.success || !portalJson.profile) {
      return res.status(upstream.status === 401 ? 401 : 502).json({
        success: false,
        error: portalJson.error || 'Portal enroll failed',
      });
    }

    const profile = portalJson.profile;
    const uid = glaUid(profile.roll || roll);

    const auth = adminAuth();
    try {
      await auth.getUser(uid);
    } catch {
      await auth.createUser({
        uid,
        displayName: profile.name || profile.roll,
        disabled: false,
      });
    }

    const customToken = await auth.createCustomToken(uid, {
      authProvider: 'gla_portal',
      roll: profile.roll || roll.toUpperCase(),
    });

    const db = adminDb();
    const { classId, created, subjectUpserts } = await ensurePortalClassAndSubjects(db, profile);
    await upsertPortalUser(db, uid, profile, classId);

    return res.status(200).json({
      success: true,
      customToken,
      uid,
      classId,
      classCreated: created,
      subjectUpserts,
      profile: {
        roll: profile.roll,
        name: profile.name,
        program: profile.program,
        branch: profile.branch,
        year: profile.year,
        section: profile.section,
        portalCohortKey: profile.portalCohortKey,
        classDisplayName: profile.classDisplayName,
        summary: profile.summary,
        subjects: (profile.subjects || []).map((s) => ({
          name: s.name,
          code: s.code,
          type: s.type,
        })),
      },
    });
  } catch (err) {
    console.error('enroll error', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Enroll failed',
    });
  }
}
