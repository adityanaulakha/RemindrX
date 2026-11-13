/**
 * Same-origin proxy for portal login (per-roll sessions), used by Attendance
 * reconnect. Password is forwarded once, never stored or logged.
 */
import { applyCors, bodyOf, clientIp, enforceLimits, type Req, type Res } from '../_lib/server.js';

const UPSTREAM = process.env.PORTAL_BACKEND_URL || 'https://portal-backend-z9ce.onrender.com';
const WINDOW_MS = 15 * 60 * 1000;

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const { roll, password, captcha } = bodyOf<{ roll: string; password: string; captcha: string }>(req);
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
    const upstream = await fetch(`${UPSTREAM}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll: r, password, captcha }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = await upstream.json().catch(() => ({ success: false, error: 'Bad portal response' }));
    return res.status(upstream.status).json(json);
  } catch {
    return res.status(502).json({ success: false, error: 'Upstream login failed — portal may be waking up.' });
  }
}
