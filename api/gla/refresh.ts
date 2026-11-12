/**
 * Refresh portal profile + subjects for an already-enrolled gla_* user.
 * Auth: Bearer Firebase ID token. Portal jar must still be live for that roll.
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

const PORTAL_BASE =
  process.env.PORTAL_BACKEND_URL || 'https://portal-backend-z9ce.onrender.com';

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => { json: (b: unknown) => void };
};

interface PortalSubjectIn {
  name?: string;
  code?: string | null;
  type?: string | null;
}

interface PortalProfileIn {
  roll: string;
  name: string;
  dob?: string | null;
  course?: string | null;
  program?: string | null;
  branch?: string | null;
  year?: string | null;
  section?: string | null;
  semester?: string | null;
  subjects?: PortalSubjectIn[];
  summary?: { overall?: string; cpi?: string };
}

let app: App | null = null;

function loadCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    return {
      projectId: parsed.project_id,
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email!,
        privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
      }),
    };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin not configured');
  }
  return {
    projectId,
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  };
}

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const { projectId, credential } = loadCredential();
  app = initializeApp({ credential, projectId });
  return app;
}

function header(req: Req, name: string): string {
  const v = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] || '' : v || '';
}

async function syncSubjects(db: Firestore, classId: string, subjects: PortalSubjectIn[]): Promise<number> {
  let upserts = 0;
  const existingSubjects = await db.collection('subjects').where('classId', '==', classId).get();
  const byPortalCode = new Map<string, QueryDocumentSnapshot>();
  const byCode = new Map<string, QueryDocumentSnapshot>();
  for (const docSnap of existingSubjects.docs) {
    const d = docSnap.data() as { portalCode?: string; code?: string };
    if (d.portalCode) byPortalCode.set(String(d.portalCode).toUpperCase(), docSnap);
    if (d.code) byCode.set(String(d.code).toUpperCase(), docSnap);
  }

  for (const sub of subjects) {
    const portalCode = sub.code ? String(sub.code).trim().toUpperCase() : '';
    const name = String(sub.name || 'Subject').trim() || 'Subject';
    const type: 'theory' | 'lab' =
      String(sub.type || '').toLowerCase() === 'lab' || /lab|practical/i.test(name) ? 'lab' : 'theory';
    const match =
      (portalCode && byPortalCode.get(portalCode)) || (portalCode && byCode.get(portalCode)) || null;

    if (match) {
      const data = match.data() as { isActive?: boolean; portalCode?: string; name?: string };
      const patch: Record<string, unknown> = {};
      if (data.isActive === false) patch.isActive = true;
      if (portalCode && !data.portalCode) patch.portalCode = portalCode;
      if (name && data.name !== name) patch.name = name;
      if (Object.keys(patch).length) {
        await match.ref.update(patch);
        upserts += 1;
      }
      continue;
    }

    await db.collection('subjects').add({
      name,
      code: portalCode || name.slice(0, 8).toUpperCase().replace(/\s+/g, ''),
      portalCode: portalCode || null,
      type,
      classId,
      credits: 0,
      isActive: true,
      source: 'portal',
      createdBy: 'portal-refresh',
      createdAt: Date.now(),
    });
    upserts += 1;
  }
  return upserts;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const authHeader = header(req, 'authorization') || header(req, 'Authorization');
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ success: false, error: 'Missing auth token' });

    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    const uid = decoded.uid;
    if (!uid.startsWith('gla_')) {
      return res.status(403).json({ success: false, error: 'Portal refresh is only for GLA portal users' });
    }
    const roll = uid.slice(4);

    const profileRes = await fetch(`${PORTAL_BASE}/profile?roll=${encodeURIComponent(roll)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!profileRes.ok) {
      return res.status(502).json({
        success: false,
        error: 'Portal session expired or backend waking — reconnect Attendance, then refresh.',
      });
    }
    const body = (await profileRes.json()) as { profile?: PortalProfileIn; error?: string };
    const profile = body.profile;
    if (!profile) {
      return res.status(502).json({
        success: false,
        error: body.error || 'Could not load portal profile',
      });
    }

    const db = getFirestore(getAdminApp());
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

    const subjectUpserts = await syncSubjects(db, classId, profile.subjects || []);

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
    console.error('refresh error', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Refresh failed',
    });
  }
}
