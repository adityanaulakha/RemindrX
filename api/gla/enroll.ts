/**
 * Portal-first student enroll — self-contained for Vercel Node ESM
 * (no relative imports; package.json has "type": "module").
 *
 * 1) Verify GLA credentials via portal-backend /enroll
 * 2) Mint Firebase custom token uid=gla_{ROLL}
 * 3) Ensure class by portalCohortKey + sync subjects
 * 4) Upsert users/{uid}
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

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

interface PortalSubjectIn {
  name?: string;
  code?: string | null;
  type?: 'theory' | 'lab' | string | null;
  attendance?: string | number | null;
}

interface PortalProfileIn {
  roll: string;
  name: string;
  program?: string | null;
  branch?: string | null;
  year?: string | null;
  section?: string | null;
  semester?: string | null;
  portalCohortKey?: string;
  classDisplayName?: string;
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
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    };
  }

  throw new Error(
    'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
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

function adminAuth() {
  return getAuth(getAdminApp());
}

function adminDb() {
  return getFirestore(getAdminApp());
}

function glaUid(roll: string): string {
  const clean = String(roll || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  return `gla_${clean}`;
}

function randCode(prefix: string, len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = prefix;
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function uniqueJoinCode(db: Firestore, base: string): Promise<string> {
  let code = base.slice(0, 48);
  for (let i = 0; i < 8; i++) {
    const snap = await db.collection('classes').where('joinCode', '==', code).limit(1).get();
    if (snap.empty) return code;
    code = `${base.slice(0, 40)}-${randCode('', 4)}`;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

async function resolveGlaInstituteId(db: Firestore): Promise<string | null> {
  const snap = await db.collection('institutes').get();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as { domains?: string[]; name?: string };
    const domains = (data.domains || []).map((d) => String(d).toLowerCase());
    if (domains.some((d) => d.includes('gla.ac.in') || d === 'gla.in' || d.includes('gla'))) {
      return docSnap.id;
    }
    if (String(data.name || '').toUpperCase().includes('GLA')) return docSnap.id;
  }
  return null;
}

function inferYearFromRoll(roll: string): string | null {
  const m = /^(\d{2})/.exec(String(roll || '').trim());
  if (!m) return null;
  const admit = 2000 + Number(m[1]);
  if (admit < 2015 || admit > new Date().getFullYear()) return null;
  const y = new Date().getFullYear() - admit + 1;
  if (y < 1 || y > 5) return null;
  return String(y);
}

function part(v: unknown, fallback = 'NA'): string {
  const s = String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  return s || fallback;
}

function subjectSignature(subjects: PortalSubjectIn[] | undefined): string {
  const codes = (subjects || [])
    .map((s) => String(s.code || '').trim().toUpperCase())
    .filter(Boolean)
    .sort();
  if (!codes.length) return 'NOSUB';
  return codes.join('+').slice(0, 48);
}

function resolvePortalCohort(profile: PortalProfileIn): {
  cohortKey: string;
  profile: PortalProfileIn;
} {
  const next: PortalProfileIn = { ...profile };
  if (!next.year) {
    const inferred = inferYearFromRoll(next.roll);
    if (inferred) next.year = inferred;
  }

  let section = part(next.section, '');
  if (!section) {
    section = subjectSignature(next.subjects);
    next.section = next.section || null;
  }

  const program = part(next.program);
  const branch = part(next.branch);
  const year = part(next.year);
  const sectionPart = section || 'NA';

  const weak =
    program === 'NA' &&
    branch === 'NA' &&
    year === 'NA' &&
    (sectionPart === 'NA' || sectionPart === 'NOSUB');

  if (weak) {
    throw new Error(
      'Could not read section allotment from the GLA portal (program/branch/year/section). Try again after the portal session loads fully.'
    );
  }

  const cohortKey = ['gla', program, branch, year, sectionPart].join('|');
  next.portalCohortKey = cohortKey;
  if (!next.classDisplayName) {
    next.classDisplayName = [
      next.program || 'GLA',
      next.branch,
      next.year ? `Year ${next.year}` : null,
      next.section
        ? `Section ${next.section}`
        : sectionPart !== 'NOSUB' && sectionPart !== 'NA'
          ? `Group ${sectionPart}`
          : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return { cohortKey, profile: next };
}

async function ensurePortalClassAndSubjects(
  db: Firestore,
  profileIn: PortalProfileIn
): Promise<{ classId: string; created: boolean; subjectUpserts: number; profile: PortalProfileIn }> {
  const { cohortKey, profile } = resolvePortalCohort(profileIn);

  const existing = await db.collection('classes').where('portalCohortKey', '==', cohortKey).limit(1).get();

  let classId: string;
  let created = false;

  if (!existing.empty) {
    classId = existing.docs[0]!.id;
  } else {
    const instituteId = await resolveGlaInstituteId(db);
    const name =
      profile.classDisplayName ||
      [profile.program || 'GLA', profile.branch, profile.year ? `Year ${profile.year}` : null, profile.section ? `Section ${profile.section}` : null]
        .filter(Boolean)
        .join(' · ');

    const joinBase = [
      String(profile.program || 'GLA').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'GLA',
      String(profile.branch || 'X').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'X',
      `Y${profile.year || 'N'}`,
      String(profile.section || 'N').toUpperCase().slice(0, 4),
    ].join('-');

    const joinCode = await uniqueJoinCode(db, joinBase);
    const adminInviteCode = `CR-${joinCode}-${randCode('', 4)}`;

    const ref = await db.collection('classes').add({
      name,
      program: profile.program || null,
      branch: profile.branch || null,
      year: profile.year ? String(profile.year) : null,
      section: profile.section ? String(profile.section).toUpperCase() : null,
      joinCode,
      adminInviteCode,
      adminCodeUses: 5,
      admins: [],
      instituteId: instituteId || null,
      portalCohortKey: cohortKey,
      source: 'portal',
      createdAt: Date.now(),
    });
    classId = ref.id;
    created = true;
  }

  let subjectUpserts = 0;
  const subjects = Array.isArray(profile.subjects) ? profile.subjects : [];
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
        subjectUpserts += 1;
      }
      continue;
    }

    await db.collection('subjects').add({
      name,
      code: portalCode || name.slice(0, 8).toUpperCase().replace(/\s+/g, ''),
      portalCode: portalCode || null,
      type,
      classId,
      isActive: true,
      createdBy: 'system',
    });
    subjectUpserts += 1;
  }

  return { classId, created, subjectUpserts, profile };
}

async function upsertPortalUser(
  db: Firestore,
  uid: string,
  profile: PortalProfileIn,
  classId: string
): Promise<void> {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const now = Date.now();
  const base = {
    name: profile.name,
    email: snap.exists ? (snap.data()?.email ?? '') : '',
    rollNo: profile.roll,
    program: profile.program || null,
    branch: profile.branch || null,
    year: profile.year ? String(profile.year) : null,
    section: profile.section ? String(profile.section).toUpperCase() : null,
    collegeId: 'gla',
    classId,
    authProvider: 'gla_portal',
    portalSyncedAt: now,
    lastActive: now,
    portalSummary: profile.summary || null,
  };

  if (!snap.exists) {
    await ref.set({
      ...base,
      role: 'student',
      trustScore: 100,
      createdAt: now,
    });
  } else {
    const existing = snap.data() || {};
    await ref.set(
      {
        ...base,
        role: existing.role || 'student',
        trustScore: existing.trustScore ?? 100,
        isSuperAdmin: existing.isSuperAdmin || false,
      },
      { merge: true }
    );
  }
}

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
    await upsertPortalUser(db, uid, mapped, classId);

    return res.status(200).json({
      success: true,
      customToken,
      uid,
      classId,
      classCreated: created,
      subjectUpserts,
      profile: {
        roll: mapped.roll,
        name: mapped.name,
        program: mapped.program,
        branch: mapped.branch,
        year: mapped.year,
        section: mapped.section,
        portalCohortKey: mapped.portalCohortKey,
        classDisplayName: mapped.classDisplayName,
        summary: mapped.summary,
        subjects: (mapped.subjects || []).map((s) => ({
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
