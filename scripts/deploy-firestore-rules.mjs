/**
 * Deploy firestore.rules using the Admin service account (no firebase login).
 * Usage: node --env-file=.env.local scripts/deploy-firestore-rules.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Firebase Admin env');
}

const source = readFileSync(resolve('firestore.rules'), 'utf8');

const auth = new GoogleAuth({
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform'],
});

const client = await auth.getClient();
const token = await client.getAccessToken();
const headers = {
  Authorization: `Bearer ${token.token || token}`,
  'Content-Type': 'application/json',
};

const createRes = await fetch(
  `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source: {
        files: [{ name: 'firestore.rules', content: source }],
      },
    }),
  }
);
const created = await createRes.json();
if (!createRes.ok) {
  console.error(created);
  process.exit(1);
}
const rulesetName = created.name;
console.log('Created ruleset:', rulesetName);

const releaseName = `projects/${projectId}/releases/cloud.firestore`;
const releaseRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    release: { name: releaseName, rulesetName },
    updateMask: 'rulesetName',
  }),
});

const body = await releaseRes.json();
if (!releaseRes.ok) {
  console.error(body);
  process.exit(1);
}
console.log('Updated release:', body.rulesetName);
console.log('Firestore rules deployed.');
