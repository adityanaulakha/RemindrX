import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export interface PortalSubjectIn {
  name?: string;
  code?: string | null;
  type?: 'theory' | 'lab' | string | null;
  attendance?: string | number | null;
}

export interface PortalProfileIn {
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
  for (const doc of snap.docs) {
    const data = doc.data() as { domains?: string[]; name?: string };
    const domains = (data.domains || []).map((d) => String(d).toLowerCase());
    if (domains.some((d) => d.includes('gla.ac.in') || d === 'gla.in' || d.includes('gla'))) {
      return doc.id;
    }
    if (String(data.name || '').toUpperCase().includes('GLA')) return doc.id;
  }
  return null;
}

export async function ensurePortalClassAndSubjects(
  db: Firestore,
  profile: PortalProfileIn
): Promise<{ classId: string; created: boolean; subjectUpserts: number }> {
  const cohortKey =
    profile.portalCohortKey ||
    [
      'gla',
      String(profile.program || 'NA').toUpperCase(),
      String(profile.branch || 'NA').toUpperCase(),
      String(profile.year || 'NA').toUpperCase(),
      String(profile.section || 'NA').toUpperCase(),
    ].join('|');

  const existing = await db
    .collection('classes')
    .where('portalCohortKey', '==', cohortKey)
    .limit(1)
    .get();

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
  for (const doc of existingSubjects.docs) {
    const d = doc.data() as { portalCode?: string; code?: string };
    if (d.portalCode) byPortalCode.set(String(d.portalCode).toUpperCase(), doc);
    if (d.code) byCode.set(String(d.code).toUpperCase(), doc);
  }

  for (const sub of subjects) {
    const portalCode = sub.code ? String(sub.code).trim().toUpperCase() : '';
    const name = String(sub.name || 'Subject').trim() || 'Subject';
    const type: 'theory' | 'lab' =
      String(sub.type || '').toLowerCase() === 'lab' || /lab|practical/i.test(name) ? 'lab' : 'theory';

    const match =
      (portalCode && byPortalCode.get(portalCode)) ||
      (portalCode && byCode.get(portalCode)) ||
      null;

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

  return { classId, created, subjectUpserts };
}

export async function upsertPortalUser(
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
    // Do not downgrade CR role or wipe isSuperAdmin
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
