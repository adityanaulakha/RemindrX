/**
 * Portal-first student sign-in.
 *
 * Students never create an account: they type their GLA portal credentials,
 * we verify them against the GLA portal (via portal-backend), and mint a
 * Firebase custom token for the deterministic uid `gla_{ROLL}`. The Firebase
 * user is only an internal identity for Firestore rules; repeat logins reuse it.
 *
 * The GLA password is forwarded to the portal once and is never stored or
 * logged here.
 *
 * 1) Rate limit (Firestore-backed, shared across instances)
 * 2) Verify GLA credentials via portal-backend /enroll
 * 3) Ensure class by portalCohortKey (race-safe) + sync subjects
 * 4) Upsert users/{uid}
 * 5) Mint custom token
 */
import {
  adminAuth,
  adminDb,
  applyCors,
  bodyOf,
  clientIp,
  enforceLimits,
  glaUid,
  type Req,
  type Res,
  portalHeaders,
} from '../_lib/server.js';
import { ensurePortalClassAndSubjects, upsertPortalUser, type PortalProfileIn } from '../_lib/portalProvision.js';

const PORTAL_BASE = process.env.PORTAL_BACKEND_URL || 'https://portal-backend-z9ce.onrender.com';
const WINDOW_MS = 15 * 60 * 1000;
const PORTAL_TIMEOUT_MS = 45_000;

async function ensureAuthUser(uid: string, displayName: string) {
  // Best effort only. signInWithCustomToken creates the Auth user on first
  // sign-in if it doesn't exist, so a failure here (quota, transient) must
  // not block login.
  try {
    await adminAuth().createUser({ uid, displayName, disabled: false });
  } catch (err) {
    const code = (err as { code?: string }).code || '';
    if (code !== 'auth/uid-already-exists') {
      console.warn('createUser skipped:', code || (err instanceof Error ? err.message : 'unknown'));
    }
  }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const body = bodyOf<{ roll: string; password: string; captcha: string; attempt?: string }>(req);
  const attempt = typeof body.attempt === 'string' && body.attempt.length <= 128 ? body.attempt : undefined;
  const roll = String(body.roll || '').trim().toUpperCase();
  const password = String(body.password || '');
  const captcha = String(body.captcha || '').trim();
  if (!roll || !password || !captcha) {
    return res.status(400).json({ success: false, error: 'roll, password, and captcha are required' });
  }
  if (!/^[A-Z0-9_-]{4,32}$/.test(roll)) {
    return res.status(400).json({ success: false, error: 'Invalid roll number' });
  }

  const ip = clientIp(req);
  // Per roll: stops password guessing on one student. Per IP: generous,
  // because a whole campus can sit behind one NAT address.
  const allowed = await enforceLimits(res, [
    { key: `enroll:roll:${roll}`, max: 10, windowMs: WINDOW_MS },
    { key: `enroll:ip:${ip}`, max: 300, windowMs: WINDOW_MS },
  ]);
  if (!allowed) return;

  try {
    let upstream: Response;
    try {
      upstream = await fetch(`${PORTAL_BASE}/enroll`, {
        method: 'POST',
        headers: portalHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ roll, password, captcha, attempt }),
        signal: AbortSignal.timeout(PORTAL_TIMEOUT_MS),
      });
    } catch {
      return res.status(504).json({
        success: false,
        error: 'GLA portal is slow to respond right now. Please try again in a minute.',
      });
    }

    const portalJson = (await upstream.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      profile?: PortalProfileIn;
      sessionToken?: string;
      expiresAt?: number;
    };

    if (!upstream.ok || !portalJson.success || !portalJson.profile) {
      const status = upstream.status === 401 ? 401 : upstream.status === 429 ? 429 : 502;
      return res.status(status).json({
        success: false,
        error: portalJson.error || 'Portal enroll failed',
      });
    }

    const profile = portalJson.profile;
    const uid = glaUid(profile.roll || roll);

    const db = adminDb();
    let provisioned;
    try {
      provisioned = await ensurePortalClassAndSubjects(db, profile);
    } catch (cohortErr) {
      return res.status(422).json({
        success: false,
        error: cohortErr instanceof Error ? cohortErr.message : 'Could not map portal section',
      });
    }
    const { classId, created, subjectUpserts, profile: mapped } = provisioned;
    const { isNew } = await upsertPortalUser(db, uid, mapped, classId);
    if (isNew) await ensureAuthUser(uid, profile.name || profile.roll || roll);

    const customToken = await adminAuth().createCustomToken(uid, {
      authProvider: 'gla_portal',
      roll: profile.roll || roll,
    });

    return res.status(200).json({
      success: true,
      customToken,
      portalSession: portalJson.sessionToken,
      portalSessionExpiresAt: portalJson.expiresAt,
      uid,
      classId,
      classCreated: created,
      subjectUpserts,
      profile: {
        roll: mapped.roll,
        name: mapped.name,
        dob: mapped.dob,
        course: mapped.course,
        program: mapped.program,
        branch: mapped.branch,
        year: mapped.year,
        section: mapped.section,
        semester: mapped.semester,
        portalCohortKey: mapped.portalCohortKey,
        classDisplayName: mapped.classDisplayName,
        summary: mapped.summary,
        subjects: (mapped.subjects || []).map((s) => ({
          name: s.name,
          code: s.code,
          type: s.type,
          attendance: s.attendance,
        })),
      },
    });
  } catch (err) {
    // Never log the request body (contains the GLA password).
    console.error('enroll error', err instanceof Error ? err.message : 'unknown');
    return res.status(500).json({ success: false, error: 'Enroll failed. Please try again.' });
  }
}
