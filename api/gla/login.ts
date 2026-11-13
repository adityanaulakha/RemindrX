/**
 * Same-origin proxy for portal login (per-roll sessions), used by Attendance
 * reconnect. Password is forwarded once, never stored or logged.
 */
import {
  applyCors,
  bodyOf,
  clientIp,
  enforceLimits,
  portalFetchRetry,
  type Req,
  type Res,
} from '../_lib/server.js';

const UPSTREAM = process.env.PORTAL_BACKEND_URL || 'https://reminder-backend-cf51.onrender.com';
const WINDOW_MS = 15 * 60 * 1000;

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const { roll, password, captcha, attempt } = bodyOf<{
    roll: string;
    password: string;
    captcha: string;
    attempt?: string;
  }>(req);
  if (!roll || !password || !captcha) {
    return res.status(400).json({ success: false, error: 'roll, password, and captcha are required' });
  }
  const r = String(roll).trim().toUpperCase();
  const allowed = await enforceLimits(res, [
    { key: `login:roll:${r}`, max: 10, windowMs: WINDOW_MS },
    { key: `login:ip:${clientIp(req)}`, max: 300, windowMs: WINDOW_MS },
  ]);
  if (!allowed) return;
  try {
    const upstream = await portalFetchRetry(`${UPSTREAM}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll: r, password, captcha, attempt }),
    });
    const json = await upstream.json().catch(() => ({ success: false, error: 'Bad portal response' }));
    return res.status(upstream.status).json(json);
  } catch {
    return res.status(502).json({
      success: false,
      error: 'Portal backend is waking up after downtime. Wait about a minute and try again.',
    });
  }
}
