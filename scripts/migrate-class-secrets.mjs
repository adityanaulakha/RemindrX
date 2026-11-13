/**
 * One-off: move joinCode / adminInviteCode / adminCodeUses / adminCodeExpiry
 * off classes/{id} (readable by every classmate) into classSecrets/{id}
 * (readable only by that class's CRs and super admins).
 *
 * Dry run (default):  node --env-file=.env.local scripts/migrate-class-secrets.mjs
 * Apply:              node --env-file=.env.local scripts/migrate-class-secrets.mjs --apply
 *
 * Run this right BEFORE deploying the new firestore.rules. /api/gla/enroll and
 * /api/class/cr also migrate lazily, so classes nobody logs into are the only
 * ones this script is strictly needed for.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const sa = json
  ? JSON.parse(json)
  : {
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY,
    };
if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error('Missing Firebase Admin env');

initializeApp({
  projectId: sa.project_id,
  credential: cert({
    projectId: sa.project_id,
    clientEmail: sa.client_email,
    privateKey: String(sa.private_key).replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();
const FIELDS = ['joinCode', 'adminInviteCode', 'adminCodeUses', 'adminCodeExpiry'];

const snap = await db.collection('classes').get();
let moved = 0;
for (const cls of snap.docs) {
  const data = cls.data();
  const legacy = FIELDS.filter((f) => data[f] !== undefined);
  if (!legacy.length) continue;
  moved += 1;
  console.log(`${apply ? 'migrating' : 'would migrate'} ${cls.id} (${data.name || ''}): ${legacy.join(', ')}`);
  if (!apply) continue;
  await db.runTransaction(async (tx) => {
    const secRef = db.collection('classSecrets').doc(cls.id);
    const sec = await tx.get(secRef);
    const existing = sec.exists ? sec.data() : {};
    const merged = { migratedAt: Date.now() };
    for (const f of legacy) if (existing[f] === undefined) merged[f] = data[f];
    tx.set(secRef, merged, { merge: true });
    const strip = {};
    for (const f of legacy) strip[f] = FieldValue.delete();
    tx.update(cls.ref, strip);
  });
}
console.log(`${snap.size} classes scanned, ${moved} ${apply ? 'migrated' : 'need migration'}.`);
