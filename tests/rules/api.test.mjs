// Integration test of the Vercel API handlers against Firestore+Auth emulators
// with a mocked GLA portal backend. Never touches production.
import http from 'node:http';
import { generateKeyPairSync } from 'node:crypto';

const portalSeen = [];
const portal = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const { roll, password, attempt } = JSON.parse(body || '{}');
    portalSeen.push({ secret: req.headers['x-portal-secret'], attempt, url: req.url });
    res.setHeader('Content-Type', 'application/json');
    if (req.headers['x-portal-secret'] !== 'test-portal-secret') { res.statusCode = 401; return res.end(JSON.stringify({ success: false, error: 'Unauthorized' })); }
    if (password !== 'right') { res.statusCode = 401; return res.end(JSON.stringify({ success: false, error: 'Invalid credentials' })); }
    setTimeout(() => res.end(JSON.stringify({ success: true, profile: {
      roll, name: 'Student ' + roll, program: 'B.Tech', branch: 'CSE', year: '3', section: 'A',
      subjects: [{ name: 'Operating Systems', code: 'BCSC0011', type: 'theory' }, { name: 'DBMS Lab', code: 'BCSC0012', type: 'lab' }],
      summary: { overall: '82%', cpi: '8.1' } }, sessionToken: 'ps_test_' + roll, expiresAt: Date.now() + 1000 })), 50);
  });
}).listen(4999);

process.env.PORTAL_BACKEND_URL = 'http://127.0.0.1:4999';
process.env.PORTAL_SHARED_SECRET = 'test-portal-secret';
process.env.FIREBASE_PROJECT_ID = 'demo-remindrx';
process.env.FIREBASE_CLIENT_EMAIL = 'test@demo-remindrx.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const enroll = (await import(new URL('../../api/gla/enroll.ts', import.meta.url).href)).default;
const cr = (await import(new URL('../../api/class/cr.ts', import.meta.url).href)).default;
const { adminDb, adminAuth } = await import(new URL('../../api/_lib/server.ts', import.meta.url).href);

function call(handler, { method = 'POST', body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const out = { headers: {} };
    handler({ method, body, headers: { 'x-forwarded-for': '10.0.0.1', ...headers } }, {
      setHeader: (k, v) => (out.headers[k] = v),
      status: (s) => ({ json: (j) => resolve({ status: s, json: j, headers: out.headers }) }),
    });
  });
}
const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);

// 1) 8 classmates enroll at the same instant → exactly one class doc
const rolls = Array.from({ length: 8 }, (_, i) => `23150010${10 + i}`);
const rs = await Promise.all(rolls.map((roll) => call(enroll, { body: { roll, password: 'right', captcha: 'x' } })));
ok('8 concurrent enrolls all succeed', rs.every((r) => r.status === 200), rs.map((r) => r.status).join(','));
const classIds = new Set(rs.map((r) => r.json.classId));
ok('they all land in ONE class (no duplicate section)', classIds.size === 1, [...classIds].join(','));
const db = adminDb();
const classSnap = await db.collection('classes').get();
ok('exactly 1 class doc exists', classSnap.size === 1, String(classSnap.size));
const cls = classSnap.docs[0].data();
ok('class doc has no invite/join codes', !('adminInviteCode' in cls) && !('joinCode' in cls));
const sec = (await db.collection('classSecrets').doc(classSnap.docs[0].id).get()).data();
ok('codes stored in classSecrets', !!sec?.adminInviteCode && !!sec?.joinCode, sec?.adminInviteCode);
const subs = await db.collection('subjects').get();
ok('portal subjects created once (2, not 16)', subs.size === 2, String(subs.size));
ok('uid is deterministic gla_{ROLL}', rs[0].json.uid === `gla_${rolls[0]}`, rs[0].json.uid);
ok('custom token minted', typeof rs[0].json.customToken === 'string' && rs[0].json.customToken.split('.').length === 3);
const userDoc = (await db.collection('users').doc(`gla_${rolls[0]}`).get()).data();
ok('enroll sends X-Portal-Secret to portal-backend', portalSeen.length > 0 && portalSeen.every((p) => p.secret === 'test-portal-secret'));
ok('portal session token returned to client', rs[0].json.portalSession === `ps_test_${rolls[0]}`, String(rs[0].json.portalSession));
const withAttempt = await call(enroll, { body: { roll: rolls[1], password: 'right', captcha: 'x', attempt: 'a_abc' } });
ok('captcha attempt id forwarded', withAttempt.status === 200 && portalSeen.at(-1).attempt === 'a_abc');
ok('no password stored on user doc', !JSON.stringify(userDoc).includes('right'));

// 2) repeat login reuses the same uid / class
const again = await call(enroll, { body: { roll: rolls[0], password: 'right', captcha: 'x' } });
ok('repeat login reuses uid + class', again.json.uid === rs[0].json.uid && again.json.classId === rs[0].json.classId);
const usersCount = (await db.collection('users').get()).size;
ok('no duplicate user docs', usersCount === 8, String(usersCount));

// 3) wrong password → 401, then per-roll rate limit kicks in (shared Firestore counter)
const bad = [];
for (let i = 0; i < 11; i++) bad.push(await call(enroll, { body: { roll: '2315009999', password: 'wrong', captcha: 'x' } }));
ok('wrong password → 401', bad[0].status === 401, String(bad[0].status));
ok('11th attempt for same roll → 429', bad[10].status === 429, bad.map((b) => b.status).join(','));
ok('Retry-After header set', !!bad[10].headers['Retry-After']);

// 4) CORS: foreign origin blocked; app origin allowed
const evil = await call(enroll, { body: {}, headers: { origin: 'https://evil.example' } });
ok('foreign Origin rejected (403)', evil.status === 403, String(evil.status));
const good = await call(enroll, { body: {}, headers: { origin: 'https://www.remindrx.xyz' } });
ok('app Origin allowed through (400 for empty body)', good.status === 400 && good.headers['Access-Control-Allow-Origin'] === 'https://www.remindrx.xyz');

const preview = await call(enroll, { body: {}, headers: { origin: 'https://remindr-ps4hmjwot-adityanaulakhas-projects.vercel.app' } });
ok('team preview Origin allowed', preview.status === 400, String(preview.status));
const same = await call(enroll, { body: {}, headers: { origin: 'https://custom.example.com', host: 'custom.example.com' } });
ok('same-origin POST allowed', same.status === 400, String(same.status));
const spoof = await call(enroll, { body: {}, headers: { origin: 'https://remindr-evil.vercel.app' } });
ok('look-alike vercel.app Origin rejected', spoof.status === 403, String(spoof.status));

// 5) CR redeem via API: needs ID token. Use the Auth emulator to exchange a custom token.
async function idTokenFor(uid) {
  const ct = await adminAuth().createCustomToken(uid);
  const r = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
  return (await r.json()).idToken;
}
const t0 = await idTokenFor(`gla_${rolls[0]}`);
const t1 = await idTokenFor(`gla_${rolls[1]}`);
const wrong = await call(cr, { body: { action: 'redeem', code: 'CR-NOPE' }, headers: { authorization: `Bearer ${t0}` } });
ok('wrong CR code → 403', wrong.status === 403, JSON.stringify(wrong.json));
const roster403 = await call(cr, { body: { action: 'roster' }, headers: { authorization: `Bearer ${t1}` } });
ok('student cannot fetch roster', roster403.status === 403);
const right = await call(cr, { body: { action: 'redeem', code: sec.adminInviteCode }, headers: { authorization: `Bearer ${t0}` } });
ok('correct CR code → becomes CR', right.status === 200 && right.json.role === 'admin', JSON.stringify(right.json));
const sec2 = (await db.collection('classSecrets').doc(classSnap.docs[0].id).get()).data();
ok('invite uses decremented 5→4', sec2.adminCodeUses === 4, String(sec2.adminCodeUses));
const roster = await call(cr, { body: { action: 'roster' }, headers: { authorization: `Bearer ${t0}` } });
ok('CR roster returns 8 students, minimal fields', roster.status === 200 && roster.json.students.length === 8 && !('dob' in roster.json.students[0]) && !('portalSummary' in roster.json.students[0]));
const demoteSelf = await call(cr, { body: { action: 'demote', userId: `gla_${rolls[0]}` }, headers: { authorization: `Bearer ${t0}` } });
ok('CR cannot demote self', demoteSelf.status === 400);
const noAuth = await call(cr, { body: { action: 'roster' } });
ok('no token → 401', noAuth.status === 401);
let brute;
for (let i = 0; i < 6; i++) brute = await call(cr, { body: { action: 'redeem', code: 'CR-GUESS-' + i }, headers: { authorization: `Bearer ${t1}` } });
ok('CR-code brute force rate limited (6th → 429)', brute.status === 429, String(brute.status));

portal.close();
for (const r of results) console.log(r.join(' | '));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} API checks passed`);
process.exit(failed ? 1 : 0);
