/**
 * Class-rep (CR) operations that must not be client-writable:
 *   POST { action: 'redeem', code }        → become CR of your own class
 *   POST { action: 'demote', userId }      → CR/super admin removes a CR
 *   POST { action: 'roster', classId? }    → minimal roster + trust scores
 * Auth: Bearer Firebase ID token. CORS: app origins only.
 */
import { timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import {
  adminDb,
  applyCors,
  bodyOf,
  clientIp,
  enforceLimits,
  verifyBearer,
  type Req,
  type Res,
} from '../_lib/server.js';
import { computeClassTrustScores, migrateClassSecrets, type ClassSecrets } from '../_lib/portalProvision.js';

type Body = { action: string; code: string; userId: string; classId: string };

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sameSecret(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function redeem(uid: string, code: string) {
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const user = await userRef.get();
  const classId = String(user.data()?.classId || '');
  if (!user.exists || !classId) throw new HttpError(400, 'You need an enrolled section first');
  if (user.data()?.role === 'admin') throw new HttpError(409, 'You are already a Class Rep');

  await migrateClassSecrets(db, classId);
  const classRef = db.collection('classes').doc(classId);
  const secretRef = db.collection('classSecrets').doc(classId);

  await db.runTransaction(async (tx) => {
    const [secSnap, userSnap] = await Promise.all([tx.get(secretRef), tx.get(userRef)]);
    const sec = (secSnap.data() || {}) as ClassSecrets;
    if (userSnap.data()?.classId !== classId) throw new HttpError(409, 'Section changed — try again');
    if (!sec.adminInviteCode || !sameSecret(sec.adminInviteCode, code)) {
      throw new HttpError(403, 'Invalid CR invite code');
    }
    if ((sec.adminCodeUses ?? 0) <= 0) throw new HttpError(403, 'CR invite code usage limit reached');
    if (sec.adminCodeExpiry && sec.adminCodeExpiry < Date.now()) {
      throw new HttpError(403, 'CR invite code has expired');
    }
    tx.update(secretRef, { adminCodeUses: FieldValue.increment(-1) });
    tx.update(classRef, { admins: FieldValue.arrayUnion(uid) });
    tx.update(userRef, { role: 'admin', crSince: Date.now() });
  });
  return { role: 'admin', classId };
}

async function callerContext(uid: string) {
  const snap = await adminDb().collection('users').doc(uid).get();
  const d = snap.data() || {};
  return {
    classId: d.classId ? String(d.classId) : '',
    isAdmin: d.role === 'admin',
    isSuperAdmin: d.isSuperAdmin === true,
  };
}

async function demote(uid: string, targetId: string) {
  if (!targetId) throw new HttpError(400, 'userId required');
  if (targetId === uid) throw new HttpError(400, 'You cannot demote yourself.');
  const me = await callerContext(uid);
  const db = adminDb();
  const targetRef = db.collection('users').doc(targetId);
  const target = await targetRef.get();
  const targetClass = String(target.data()?.classId || '');
  if (!target.exists || !targetClass) throw new HttpError(404, 'Student not found');
  const allowed = me.isSuperAdmin || (me.isAdmin && me.classId === targetClass);
  if (!allowed) throw new HttpError(403, 'Only a CR of this section can do that');
  const batch = db.batch();
  batch.update(targetRef, { role: 'student' });
  batch.update(db.collection('classes').doc(targetClass), { admins: FieldValue.arrayRemove(targetId) });
  await batch.commit();
  return { userId: targetId, role: 'student' };
}

async function roster(uid: string, requestedClassId: string) {
  const me = await callerContext(uid);
  const classId = me.isSuperAdmin && requestedClassId ? requestedClassId : me.classId;
  if (!classId) throw new HttpError(400, 'No section');
  if (!me.isSuperAdmin && !(me.isAdmin && me.classId === classId)) {
    throw new HttpError(403, 'Only CRs can view the section roster');
  }
  const db = adminDb();
  const [studentsSnap, scores] = await Promise.all([
    db
      .collection('users')
      .where('classId', '==', classId)
      .select('name', 'rollNo', 'email', 'role', 'lastActive', 'trustScore')
      .limit(500)
      .get(),
    computeClassTrustScores(db, classId),
  ]);

  // Persist changed trust scores (server-owned field) for leaderboards.
  const batch = db.batch();
  let writes = 0;
  const students = studentsSnap.docs.map((d) => {
    const data = d.data();
    const score = scores[d.id] ?? 0;
    if (data.trustScore !== score && writes < 450) {
      batch.update(d.ref, { trustScore: score });
      writes += 1;
    }
    return {
      id: d.id,
      name: String(data.name || ''),
      rollNo: data.rollNo ? String(data.rollNo) : '',
      email: data.email ? String(data.email) : '',
      role: data.role === 'admin' ? 'admin' : 'student',
      lastActive: typeof data.lastActive === 'number' ? data.lastActive : null,
      trustScore: score,
    };
  });
  if (writes) await batch.commit();
  return { classId, students };
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const decoded = await verifyBearer(req);
  if (!decoded) return res.status(401).json({ success: false, error: 'Sign in again' });

  const body = bodyOf<Body>(req);
  const action = String(body.action || '');
  try {
    if (action === 'redeem') {
      const code = String(body.code || '').trim();
      if (!code) return res.status(400).json({ success: false, error: 'Enter the CR invite code' });
      const ok = await enforceLimits(res, [
        { key: `cr-redeem:uid:${decoded.uid}`, max: 5, windowMs: 15 * 60 * 1000 },
        { key: `cr-redeem:ip:${clientIp(req)}`, max: 50, windowMs: 15 * 60 * 1000 },
      ]);
      if (!ok) return;
      return res.status(200).json({ success: true, ...(await redeem(decoded.uid, code)) });
    }
    if (action === 'demote') {
      return res.status(200).json({ success: true, ...(await demote(decoded.uid, String(body.userId || ''))) });
    }
    if (action === 'roster') {
      return res.status(200).json({ success: true, ...(await roster(decoded.uid, String(body.classId || ''))) });
    }
    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ success: false, error: err.message });
    console.error('cr api error', action, err instanceof Error ? err.message : 'unknown');
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
}
