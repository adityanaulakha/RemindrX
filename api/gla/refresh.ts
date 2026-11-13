/**
 * Refresh portal profile + subjects for an already-enrolled gla_* user.
 * Auth: Bearer Firebase ID token.
 * Portal: body.portalSession (ps_…) → Authorization Bearer on portal /profile.
 * CORS: app origins only.
 */
import {
  adminDb,
  applyCors,
  bodyOf,
  enforceLimits,
  verifyBearer,
  type Req,
  type Res,
  portalFetchRetry,
  portalHeaders,
} from '../_lib/server.js';
import { syncSubjects, upsertPortalUser, type PortalProfileIn } from '../_lib/portalProvision.js';
import {
  enrichProfileWithSession,
  fetchPortalProfileWithSession,
  mergePortalProfiles,
} from '../_lib/portalProfile.js';

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

    const body = bodyOf<{ portalSession?: string }>(req);
    const portalSession =
      typeof body.portalSession === 'string' && body.portalSession.startsWith('ps_')
        ? body.portalSession
        : undefined;

    let partial: Partial<PortalProfileIn> | null = null;

    if (portalSession) {
      try {
        partial = await fetchPortalProfileWithSession(PORTAL_BASE, portalSession);
      } catch {
        return res.status(504).json({
          success: false,
          error: 'Portal backend is waking up after downtime. Wait about a minute and try again.',
        });
      }
    }

    // Legacy fallback: shared-secret + roll (older portal-backend builds)
    if (!partial) {
      let profileRes: Response;
      try {
        profileRes = await portalFetchRetry(`${PORTAL_BASE}/profile?roll=${encodeURIComponent(roll)}`, {
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
              ? 'Portal session expired — open Attendance, reconnect once, then sync again.'
              : 'Could not load portal profile — try again in a minute.',
        });
      }
      const legacy = (await profileRes.json().catch(() => ({}))) as { profile?: PortalProfileIn; error?: string };
      partial = legacy.profile || null;
      if (!partial) {
        return res.status(502).json({ success: false, error: legacy.error || 'Could not load portal profile' });
      }
    }

    if (!partial) {
      return res.status(502).json({
        success: false,
        error: portalSession
          ? 'Could not load portal profile — reconnect on Attendance, then sync.'
          : 'Portal session missing — open Attendance to reconnect, then sync from portal.',
      });
    }

    const db = adminDb();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'User not found — re-enroll from Login' });
    }
    const existing = snap.data() || {};
    const classId = String(existing.classId || '');
    if (!classId) {
      return res.status(422).json({ success: false, error: 'No class mapped yet — re-enroll from Login' });
    }

    const base: PortalProfileIn = {
      roll,
      name: String(existing.name || `Student ${roll}`),
      dob: existing.dob || null,
      course: existing.course || null,
      program: existing.program || null,
      branch: existing.branch || null,
      year: existing.year || null,
      section: existing.section || null,
      semester: existing.semester || null,
      subjects: [],
      summary: existing.portalSummary || null,
    };

    let profile = mergePortalProfiles(base, partial);
    if (portalSession) {
      profile = await enrichProfileWithSession(PORTAL_BASE, portalSession, profile);
    }

    await upsertPortalUser(db, uid, profile, classId);
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
