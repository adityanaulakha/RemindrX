import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-remindrx',
  firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users/gla_A1'), { name: 'Stu A', classId: 'C1', role: 'student', trustScore: 0 });
  await setDoc(doc(db, 'users/gla_A2'), { name: 'Stu A2', classId: 'C1', role: 'student', trustScore: 0 });
  await setDoc(doc(db, 'users/gla_CR1'), { name: 'CR A', classId: 'C1', role: 'admin', trustScore: 0 });
  await setDoc(doc(db, 'users/gla_B1'), { name: 'Stu B', classId: 'C2', role: 'student', trustScore: 0 });
  await setDoc(doc(db, 'users/super'), { name: 'Super', classId: null, role: 'student', isSuperAdmin: true });
  await setDoc(doc(db, 'classes/C1'), { name: 'Class 1', admins: ['gla_CR1'] });
  await setDoc(doc(db, 'classes/C2'), { name: 'Class 2', admins: [] });
  await setDoc(doc(db, 'classSecrets/C1'), { adminInviteCode: 'CR-SECRET-1', joinCode: 'J1', adminCodeUses: 5 });
  await setDoc(doc(db, 'subjects/S1'), { name: 'Maths', classId: 'C1', isActive: true, createdBy: 'system' });
  await setDoc(doc(db, 'posts/P1'), { content: 'hi', classId: 'C1', subjectId: 'S1', createdBy: 'gla_A2', confirmations: ['gla_A2'], disputes: [], status: 'unverified', createdAt: Date.now() });
  await setDoc(doc(db, 'posts/P2'), { content: 'b', classId: 'C2', subjectId: 'S9', createdBy: 'gla_B1', confirmations: ['gla_B1'], disputes: [], status: 'unverified', createdAt: Date.now() });
  await setDoc(doc(db, 'tasks/T1'), { title: 't', classId: 'C1', subjectId: 'S1', createdBy: 'gla_CR1', deadline: Date.now() + 1e6, completedBy: [] });
  await setDoc(doc(db, 'events/E1'), { title: 'ok', status: 'approved', createdBy: 'gla_B1', goingCount: 3, date: Date.now() });
  await setDoc(doc(db, 'events/E2'), { title: 'pend', status: 'pending', createdBy: 'gla_B1', goingCount: 0, date: Date.now() });
  await setDoc(doc(db, 'event_participations/X1'), { userId: 'gla_B1', eventId: 'E1', status: 'going' });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const A = as('gla_A1'), CR = as('gla_CR1'), SA = as('super'), B = as('gla_B1');

const results = [];
async function check(name, p, expect) {
  try {
    await (expect === 'allow' ? assertSucceeds(p) : assertFails(p));
    results.push(['PASS', expect.toUpperCase(), name]);
  } catch (e) {
    results.push(['FAIL', expect.toUpperCase(), name + ' :: ' + (e.message || e).split('\n')[0]]);
  }
}

// --- privilege escalation ---
await check('student sets isSuperAdmin on own profile', updateDoc(doc(A, 'users/gla_A1'), { isSuperAdmin: true }), 'deny');
await check('student sets role=admin on own profile', updateDoc(doc(A, 'users/gla_A1'), { role: 'admin' }), 'deny');
await check('student moves self to another classId', updateDoc(doc(A, 'users/gla_A1'), { classId: 'C2' }), 'deny');
await check('student writes own trustScore', updateDoc(doc(A, 'users/gla_A1'), { trustScore: 999 }), 'deny');
await check('portal student renames self', updateDoc(doc(A, 'users/gla_A1'), { name: 'Hacker' }), 'deny');
await check('student updates deadlinePreference', updateDoc(doc(A, 'users/gla_A1'), { deadlinePreference: 3 }), 'allow');
await check('new user self-creates as admin', setDoc(doc(as('newbie'), 'users/newbie'), { name: 'x', role: 'admin', classId: null }), 'deny');
await check('new user self-creates plain profile', setDoc(doc(as('newbie2'), 'users/newbie2'), { name: 'x', role: 'student', classId: null, trustScore: 0 }), 'allow');
await check('student adds self to class admins', updateDoc(doc(A, 'classes/C1'), { admins: arrayUnion('gla_A1') }), 'deny');
await check('student promotes classmate in users doc', updateDoc(doc(A, 'users/gla_A2'), { role: 'admin' }), 'deny');

// --- user isolation ---
await check('student reads own profile', getDoc(doc(A, 'users/gla_A1')), 'allow');
await check('student reads classmate profile', getDoc(doc(A, 'users/gla_A2')), 'deny');
await check('student reads other-class profile', getDoc(doc(A, 'users/gla_B1')), 'deny');
await check('student lists all users', getDocs(collection(A, 'users')), 'deny');
await check('super admin reads any profile', getDoc(doc(SA, 'users/gla_B1')), 'allow');

// --- class isolation ---
await check('student reads own class', getDoc(doc(A, 'classes/C1')), 'allow');
await check('student reads another class', getDoc(doc(A, 'classes/C2')), 'deny');
await check('student lists all classes', getDocs(collection(A, 'classes')), 'deny');
await check('student queries other class posts', getDocs(query(collection(A, 'posts'), where('classId', '==', 'C2'))), 'deny');
await check('student queries own class posts', getDocs(query(collection(A, 'posts'), where('classId', '==', 'C1'))), 'allow');
await check('student reads other-class post by id', getDoc(doc(A, 'posts/P2')), 'deny');
await check('student queries posts without class filter', getDocs(query(collection(A, 'posts'), where('createdBy', '==', 'gla_B1'))), 'deny');

// --- invite codes ---
await check('student reads own class invite code', getDoc(doc(A, 'classSecrets/C1')), 'deny');
await check('student lists classSecrets', getDocs(collection(A, 'classSecrets')), 'deny');
await check('CR reads own class invite code', getDoc(doc(CR, 'classSecrets/C1')), 'allow');
await check('CR reads other class invite code', getDoc(doc(CR, 'classSecrets/C2')), 'deny');
await check('CR rewrites invite code uses', updateDoc(doc(CR, 'classSecrets/C1'), { adminCodeUses: 99 }), 'deny');
await check('rateLimits not client readable', getDoc(doc(A, 'rateLimits/x')), 'deny');

// --- posts ---
await check('classmate confirms post (own uid only)', updateDoc(doc(A, 'posts/P1'), { confirmations: ['gla_A2', 'gla_A1'], status: 'likely' }), 'allow');
await check('classmate forges confirmations for others', updateDoc(doc(A, 'posts/P1'), { confirmations: ['gla_A2', 'gla_A1', 'x', 'y'], status: 'verified' }), 'deny');
await check('classmate edits someone else post content', updateDoc(doc(A, 'posts/P1'), { content: 'pwned' }), 'deny');
await check('creator edits own post content', updateDoc(doc(as('gla_A2'), 'posts/P1'), { content: 'edited', status: 'unverified', confirmations: ['gla_A2'], disputes: [], updatedAt: 1 }), 'allow');
await check('student creates post in other class', addDoc(collection(A, 'posts'), { content: 'x', classId: 'C2', subjectId: 'S9', createdBy: 'gla_A1', confirmations: ['gla_A1'], disputes: [], status: 'unverified', createdAt: 1 }), 'deny');
await check('student creates pre-verified post', addDoc(collection(A, 'posts'), { content: 'x', classId: 'C1', subjectId: 'S1', createdBy: 'gla_A1', confirmations: ['gla_A1'], disputes: [], status: 'verified', createdAt: 1 }), 'deny');

// --- tasks ---
await check('classmate marks task done for self', updateDoc(doc(A, 'tasks/T1'), { completedBy: arrayUnion('gla_A1') }), 'allow');
await check('classmate marks task done for someone else', updateDoc(doc(A, 'tasks/T1'), { completedBy: arrayUnion('gla_A2') }), 'deny');
await check('classmate edits task deadline', updateDoc(doc(A, 'tasks/T1'), { deadline: 1 }), 'deny');

// --- subjects ---
await check('student deletes subject', deleteDoc(doc(A, 'subjects/S1')), 'deny');
await check('super admin deletes subject', deleteDoc(doc(SA, 'subjects/S1')), 'allow');

// --- events ---
await check('student creates pre-approved event', addDoc(collection(A, 'events'), { title: 'x', status: 'approved', createdBy: 'gla_A1', goingCount: 0, date: 1 }), 'deny');
await check('student creates pending event', addDoc(collection(A, 'events'), { title: 'x', status: 'pending', createdBy: 'gla_A1', goingCount: 0, date: 1 }), 'allow');
await check('student reads someone else pending event', getDoc(doc(A, 'events/E2')), 'deny');
await check('creator reads own pending event', getDoc(doc(B, 'events/E2')), 'allow');
await check('student reads approved event', getDoc(doc(A, 'events/E1')), 'allow');
await check('student inflates goingCount by 50', updateDoc(doc(A, 'events/E1'), { goingCount: 53 }), 'deny');
await check('student approves own event', updateDoc(doc(B, 'events/E2'), { status: 'approved' }), 'deny');
await check('student reads someone else participation', getDoc(doc(A, 'event_participations/X1')), 'deny');
await check('owner reads own participation', getDoc(doc(B, 'event_participations/X1')), 'allow');

// --- notifications ---
await check('CR notifies classmate', addDoc(collection(CR, 'notifications'), { userId: 'gla_A1', classId: 'C1', createdBy: 'gla_CR1', title: 't', message: 'm', read: false, createdAt: 1 }), 'allow');
await check('CR notifies student in other class', addDoc(collection(CR, 'notifications'), { userId: 'gla_B1', classId: 'C1', createdBy: 'gla_CR1', title: 't', message: 'm', read: false, createdAt: 1 }), 'deny');
await check('student notifies someone else', addDoc(collection(A, 'notifications'), { userId: 'gla_B1', title: 'spam', message: 'm', read: false, createdAt: 1 }), 'deny');

// --- queries the app actually issues must keep working ---
await check('app: approved events window query', getDocs(query(collection(A, 'events'), where('status', '==', 'approved'), where('date', '>=', 0))), 'allow');
await check('app: own participations query', getDocs(query(collection(A, 'event_participations'), where('userId', '==', 'gla_A1'))), 'allow');
await check('app: own notifications query', getDocs(query(collection(A, 'notifications'), where('userId', '==', 'gla_A1'))), 'allow');
await check('app: class tasks window query', getDocs(query(collection(A, 'tasks'), where('classId', '==', 'C1'), where('deadline', '>=', 0))), 'allow');
await check('app: class subjects query', getDocs(query(collection(A, 'subjects'), where('classId', '==', 'C1'), where('isActive', '==', true))), 'allow');
await check('app: own trust-score posts query', getDocs(query(collection(A, 'posts'), where('classId', '==', 'C1'), where('createdBy', '==', 'gla_A1'))), 'allow');
await check('app: super admin lists users', getDocs(collection(SA, 'users')), 'allow');
await check('app: super admin reads class secrets', getDoc(doc(SA, 'classSecrets/C1')), 'allow');
await check('app: CR soft-deletes own-class subject', (async () => { await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'subjects/S2'), { name: 'Phy', classId: 'C1', isActive: true, createdBy: 'system' })); return updateDoc(doc(CR, 'subjects/S2'), { isActive: false }); })(), 'allow');

await env.cleanup();
for (const r of results) console.log(r.join(' | '));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} rule checks passed`);
process.exit(failed ? 1 : 0);
