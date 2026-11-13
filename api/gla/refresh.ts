/**
 * Refresh portal profile + subjects for an already-enrolled gla_* user.
 * Auth: Bearer Firebase ID token. Portal session must still be live for that roll.
 * CORS: app origins only.
 */
import {
  adminDb,
  applyCors,
  enforceLimits,
  verifyBearer,
  type Req,
  type Res,
  portalFetchRetry,
  portalHeaders,
} from '../_lib/server.js';
import { syncSubjects, type PortalProfileIn } from '../_lib/portalProvision.js';

const PORTAL_BASE = process.env.PORTAL_BACKEND_URL || 'https://reminder-backend-cf51.onrender.com';

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const decoded = await verifyBearer(req);
    if (!decoded) return res.status(401).json({ success: false, error: 'Missing or invalid auth token' });
    const uid = decoded.uid;
    if (!uid.startsWith('gla_')) {
      return res.status(403).json({ success: false, error: 'Portal refresh is only for GLA portal users' });
    }
    const roll = uid.slice(4);

    const allowed = await enforceLimits(res, [{ key: `refresh:uid:${uid}`, max: 20, windowMs: 15 * 60 * 1000 }]);
    if (!allowed) return;

    let profileRes: Response;
    try {
      profileRes = await portalFetchRetry(`${PORTAL_BASE}/profile`, {
        headers: portalHeaders({ Accept: 'application/json', 'X-Portal-Roll': roll }),
      });
    } catch {
      return res.status(504).json({
        success: false,
        error: 'Portal backend is waking up after downtime. Wait about a minute and try again.',
      });
    }
    if (!profileRes.ok) {
      return res.status(502).json({
        success: false,
        error:
          profileRes.status === 401
            ? 'Portal session expired — reconnect once on Attendance, then refresh.'
            : 'Could not load portal profile — try again in a minute.',
      });
    }
    const body = (await profileRes.json().catch(() => ({}))) as { profile?: PortalProfileIn; error?: string };
    const profile = body.profile;
    if (!profile) {
      return res.status(502).json({ success: false, error: body.error || 'Could not load portal profile' });
    }

    const db = adminDb();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'User not found — re-enroll from Login' });
    }
    const classId = String(snap.data()?.classId || '');
    if (!classId) {
      return res.status(422).json({ success: false, error: 'No class mapped yet — re-enroll from Login' });
    }

    const now = Date.now();
    await userRef.set(
      {
        name: profile.name,
        dob: profile.dob || null,
        course: profile.course || profile.program || null,
        program: profile.program || profile.course || null,
        branch: profile.branch || null,
        year: profile.year ? String(profile.year) : null,
        section: profile.section ? String(profile.section).toUpperCase() : null,
        semester: profile.semester || null,
        portalSyncedAt: now,
        portalSummary: profile.summary || null,
        lastActive: now,
      },
      { merge: true }
    );

    const subjectUpserts = await syncSubjects(db, classId, profile.subjects || [], 'portal-refresh');

    return res.status(200).json({
      success: true,
      classId,
      subjectUpserts,
      profile: {
        name: profile.name,
        dob: profile.dob,
        course: profile.course,
        program: profile.program,
        branch: profile.branch,
        year: profile.year,
        section: profile.section,
        semester: profile.semester,
        summary: profile.summary,
      },
    });
  } catch (err) {
    console.error('refresh error', err instanceof Error ? err.message : 'unknown');
    return res.status(500).json({ success: false, error: 'Refresh failed' });
  }
}
