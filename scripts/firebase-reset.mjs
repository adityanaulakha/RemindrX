/**
 * One-shot destructive reset for remindrx-1:
 * - delete all Auth users
 * - wipe app Firestore collections
 * - seed GLA institute
 * - create sole Super Admin
 *
 * Usage: node --env-file=.env.local scripts/firebase-reset.mjs
 */
import { randomBytes } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTIONS = [
  'users',
  'classes',
  'subjects',
  'tasks',
  'posts',
  'events',
  'event_participations',
  'notifications',
  'class_change_requests',
  'institutes',
];

function loadCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
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

function genPassword(bytes = 18) {
  return randomBytes(bytes).toString('base64url');
}

async function deleteAllAuthUsers(auth) {
  let nextPageToken;
  let total = 0;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    if (page.users.length) {
      const result = await auth.deleteUsers(page.users.map((u) => u.uid));
      total += result.successCount;
      if (result.errors?.length) {
        console.warn('Auth delete errors:', result.errors.slice(0, 5));
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return total;
}

async function wipeCollection(db, name) {
  const col = db.collection(name);
  let deleted = 0;
  while (true) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

async function main() {
  if (getApps().length === 0) {
    const { projectId, credential } = loadCredential();
    initializeApp({ credential, projectId });
    console.log('Project:', projectId);
  }

  const auth = getAuth();
  const db = getFirestore();

  console.log('Deleting Auth users…');
  const authDeleted = await deleteAllAuthUsers(auth);
  console.log(`Auth users deleted: ${authDeleted}`);

  for (const name of COLLECTIONS) {
    const n = await wipeCollection(db, name);
    console.log(`Wiped ${name}: ${n}`);
  }

  const instituteRef = await db.collection('institutes').add({
    name: 'GLA University',
    domains: ['gla.ac.in', 'gla.in'],
    createdAt: Date.now(),
  });
  console.log('Seeded institute:', instituteRef.id);

  const email = 'admin@remindrx.app';
  const password = genPassword();
  const userRecord = await auth.createUser({
    email,
    password,
    emailVerified: true,
    displayName: 'RemindrX Super Admin',
    disabled: false,
  });

  const now = Date.now();
  await db.collection('users').doc(userRecord.uid).set({
    name: 'RemindrX Super Admin',
    email,
    classId: null,
    role: 'admin',
    isSuperAdmin: true,
    trustScore: 100,
    collegeId: 'gla',
    authProvider: 'email',
    createdAt: now,
    lastActive: now,
  });

  console.log('\n=== SUPER ADMIN (save these — shown once) ===');
  console.log(`email:    ${email}`);
  console.log(`password: ${password}`);
  console.log(`uid:      ${userRecord.uid}`);
  console.log('============================================\n');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
