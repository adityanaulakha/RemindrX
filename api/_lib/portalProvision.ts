/**
 * Server-side (Admin SDK) provisioning for GLA portal students:
 * class-by-cohort (race-safe), subject sync, user upsert, class secrets.
 */
import { randomInt } from 'node:crypto';
import { FieldValue, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { sha } from './server.js';

export interface PortalSubjectIn {
  name?: string;
  code?: string | null;
  type?: 'theory' | 'lab' | string | null;
  attendance?: string | number | null;
}

export interface PortalProfileIn {
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
  subjects?: PortalSubjectIn[];
  summary?: { overall?: string; cpi?: string };
}

export interface ClassSecrets {
  joinCode?: string;
  adminInviteCode?: string;
  adminCodeUses?: number;
  adminCodeExpiry?: number | null;
}

const SECRET_FIELDS = ['joinCode', 'adminInviteCode', 'adminCodeUses', 'adminCodeExpiry'] as const;

function randCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

async function uniqueJoinCode(db: Firestore, base: string): Promise<string> {
  let code = base.slice(0, 48);
  for (let i = 0; i < 8; i++) {
    const snap = await db.collection('classSecrets').where('joinCode', '==', code).limit(1).get();
    if (snap.empty) return code;
    code = `${base.slice(0, 40)}-${randCode(4)}`;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

async function resolveGlaInstituteId(db: Firestore): Promise<string | null> {
  const snap = await db.collection('institutes').limit(50).get();
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

/** Infer academic year from GLA-style roll prefix (e.g. 2215… → admit 2022). */
export function inferYearFromRoll(roll: string): string | null {
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

/**
 * Build a usable cohort key. Rejects the all-NA mega-class when we have no
 * program/branch/year/section AND no subject codes to fingerprint.
 */
export function resolvePortalCohort(profile: PortalProfileIn): {
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
    program === 'NA' && branch === 'NA' && year === 'NA' && (sectionPart === 'NA' || sectionPart === 'NOSUB');
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

/** Deterministic class doc id for a portal cohort → concurrent enrolls converge. */
export function cohortClassId(cohortKey: string): string {
  return `cohort_${sha(cohortKey, 24)}`;
}

/**
 * Move legacy invite/join codes off the (member-readable) class doc into
 * classSecrets/{classId}. Idempotent; safe to call on every enroll.
 */
export async function migrateClassSecrets(db: Firestore, classId: string): Promise<void> {
  const classRef = db.collection('classes').doc(classId);
  const secretRef = db.collection('classSecrets').doc(classId);
  await db.runTransaction(async (tx) => {
    const [cls, sec] = await Promise.all([tx.get(classRef), tx.get(secretRef)]);
    if (!cls.exists) return;
    const data = cls.data() || {};
    const legacy = SECRET_FIELDS.filter((f) => data[f] !== undefined);
    if (!legacy.length) return;
    const existing = (sec.exists ? sec.data() : {}) as ClassSecrets;
    const merged: Record<string, unknown> = { migratedAt: Date.now() };
    for (const f of SECRET_FIELDS) {
      if (existing[f] === undefined && data[f] !== undefined) merged[f] = data[f];
    }
    tx.set(secretRef, merged, { merge: true });
    const strip: Record<string, unknown> = {};
    for (const f of legacy) strip[f] = FieldValue.delete();
    tx.update(classRef, strip);
  });
}

export async function ensurePortalClassAndSubjects(
  db: Firestore,
  profileIn: PortalProfileIn
): Promise<{ classId: string; created: boolean; subjectUpserts: number; profile: PortalProfileIn }> {
  const { cohortKey, profile } = resolvePortalCohort(profileIn);

  // 1) Legacy classes (random ids) created before deterministic ids.
  const existing = await db.collection('classes').where('portalCohortKey', '==', cohortKey).limit(1).get();

  let classId: string;
  let created = false;

  if (!existing.empty) {
    classId = existing.docs[0]!.id;
    await migrateClassSecrets(db, classId).catch((e) =>
      console.error('migrateClassSecrets failed', e instanceof Error ? e.message : e)
    );
  } else {
    // 2) Deterministic id + transaction: two classmates enrolling at the same
    //    moment both land on the same class doc (no duplicates).
    classId = cohortClassId(cohortKey);
    const classRef = db.collection('classes').doc(classId);
    const secretRef = db.collection('classSecrets').doc(classId);

    const already = await classRef.get();
    if (!already.exists) {
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
      const adminInviteCode = `CR-${joinCode}-${randCode(4)}`;

      created = await db.runTransaction(async (tx) => {
        const snap = await tx.get(classRef);
        if (snap.exists) return false;
        tx.create(classRef, {
          name,
          program: profile.program || null,
          branch: profile.branch || null,
          year: profile.year ? String(profile.year) : null,
          section: profile.section ? String(profile.section).toUpperCase() : null,
          admins: [],
          instituteId: instituteId || null,
          portalCohortKey: cohortKey,
          source: 'portal',
          createdAt: Date.now(),
        });
        tx.set(secretRef, { joinCode, adminInviteCode, adminCodeUses: 5, createdAt: Date.now() });
        return true;
      });
    }
  }

  const subjectUpserts = await syncSubjects(db, classId, profile.subjects || [], 'system');
  return { classId, created, subjectUpserts, profile };
}

/**
 * Upsert portal subjects for a class. New portal subjects get deterministic
 * ids (`{classId}__{CODE}`) and are created with `create()` so concurrent
 * classmates can't insert duplicates.
 */
export async function syncSubjects(
  db: Firestore,
  classId: string,
  subjects: PortalSubjectIn[],
  createdBy: string
): Promise<number> {
  if (!Array.isArray(subjects) || !subjects.length) return 0;
  let upserts = 0;
  const existingSubjects = await db.collection('subjects').where('classId', '==', classId).limit(300).get();
  const byPortalCode = new Map<string, QueryDocumentSnapshot>();
  const byCode = new Map<string, QueryDocumentSnapshot>();
  for (const docSnap of existingSubjects.docs) {
    const d = docSnap.data() as { portalCode?: string; code?: string };
    if (d.portalCode) byPortalCode.set(String(d.portalCode).toUpperCase(), docSnap);
    if (d.code) byCode.set(String(d.code).toUpperCase(), docSnap);
  }

  let batch = db.batch();
  let batchOps = 0;
  const flush = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const sub of subjects) {
    const portalCode = sub.code ? String(sub.code).trim().toUpperCase() : '';
    const name = String(sub.name || 'Subject').trim() || 'Subject';
    const type: 'theory' | 'lab' =
      String(sub.type || '').toLowerCase() === 'lab' || /lab|practical/i.test(name) ? 'lab' : 'theory';

    const match = (portalCode && (byPortalCode.get(portalCode) || byCode.get(portalCode))) || null;
    if (match) {
      const data = match.data() as { isActive?: boolean; portalCode?: string; name?: string };
      const patch: Record<string, unknown> = {};
      if (data.isActive === false) patch.isActive = true;
      if (portalCode && !data.portalCode) patch.portalCode = portalCode;
      if (name && data.name !== name) patch.name = name;
      if (Object.keys(patch).length) {
        batch.update(match.ref, patch);
        batchOps += 1;
        upserts += 1;
        if (batchOps >= 400) await flush();
      }
      continue;
    }

    const docData = {
      name,
      code: portalCode || name.slice(0, 8).toUpperCase().replace(/\s+/g, ''),
      portalCode: portalCode || null,
      type,
      classId,
      credits: 0,
      isActive: true,
      source: 'portal',
      createdBy,
      createdAt: Date.now(),
    };
    if (portalCode) {
      const ref = db.collection('subjects').doc(`${classId}__${portalCode.replace(/[^A-Z0-9_-]/g, '_')}`);
      batch.set(ref, docData, { merge: true });
      batchOps += 1;
      upserts += 1;
      if (batchOps >= 400) await flush();
    } else {
      const ref = db.collection('subjects').doc();
      batch.set(ref, docData);
      batchOps += 1;
      upserts += 1;
      if (batchOps >= 400) await flush();
    }
  }
  await flush();
  return upserts;
}

export async function upsertPortalUser(
  db: Firestore,
  uid: string,
  profile: PortalProfileIn,
  classId: string
): Promise<{ isNew: boolean }> {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const now = Date.now();
  const base = {
    name: profile.name,
    rollNo: profile.roll,
    dob: profile.dob || null,
    course: profile.course || profile.program || null,
    program: profile.program || profile.course || null,
    branch: profile.branch || null,
    year: profile.year ? String(profile.year) : null,
    section: profile.section ? String(profile.section).toUpperCase() : null,
    semester: profile.semester || null,
    collegeId: 'gla',
    classId,
    authProvider: 'gla_portal',
    portalSyncedAt: now,
    lastActive: now,
    portalSummary: profile.summary || null,
  };

  if (!snap.exists) {
    await ref.set({ ...base, email: '', role: 'student', trustScore: 0, createdAt: now });
    return { isNew: true };
  }

  const existing = snap.data() || {};
  // Moving to a different section drops CR rights for the old one.
  const movedClass = existing.classId && existing.classId !== classId;
  await ref.set(
    {
      ...base,
      role: movedClass ? 'student' : existing.role || 'student',
    },
    { merge: true }
  );
  if (movedClass && existing.role === 'admin') {
    await db
      .collection('classes')
      .doc(String(existing.classId))
      .update({ admins: FieldValue.arrayRemove(uid) })
      .catch(() => undefined);
  }
  return { isNew: false };
}

// ---------- trust score (server-side) ----------

interface PostLite {
  createdBy?: string;
  status?: string;
  confirmations?: string[];
  disputes?: string[];
}

/**
 * Trust score per author for a class, from the class's posts in ONE query:
 * +10 per verified post, +1 per confirmation from others, -1 per dispute.
 */
export async function computeClassTrustScores(db: Firestore, classId: string): Promise<Record<string, number>> {
  const snap = await db
    .collection('posts')
    .where('classId', '==', classId)
    .select('createdBy', 'status', 'confirmations', 'disputes')
    .limit(2000)
    .get();
  const scores: Record<string, number> = {};
  for (const d of snap.docs) {
    const p = d.data() as PostLite;
    if (!p.createdBy) continue;
    const conf = Array.isArray(p.confirmations) ? p.confirmations : [];
    const disp = Array.isArray(p.disputes) ? p.disputes : [];
    let s = p.status === 'verified' ? 10 : 0;
    s += conf.filter((u) => u !== p.createdBy).length;
    s -= disp.length;
    scores[p.createdBy] = (scores[p.createdBy] || 0) + s;
  }
  for (const k of Object.keys(scores)) scores[k] = Math.max(0, scores[k]!);
  return scores;
}
