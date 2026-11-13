/**
 * Same-origin captcha proxy so captcha + enroll always use PORTAL_BACKEND_URL.
 * Avoids "Captcha expired" when the Vite-built client and Vercel API pointed at
 * different Render hosts (attempt minted on host A, redeemed on host B).
 *
 * GET /api/gla/captcha?roll=…
 * → { success, attempt, imageBase64, contentType }
 */
import {
  applyCors,
  clientIp,
  enforceLimits,
  portalFetchRetry,
  type Req,
  type Res,
} from '../_lib/server.js';

const PORTAL_BASE = process.env.PORTAL_BACKEND_URL || 'https://reminder-backend-cf51.onrender.com';
const WINDOW_MS = 15 * 60 * 1000;

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const rollRaw = req.query?.roll;
  const roll = String(Array.isArray(rollRaw) ? rollRaw[0] : rollRaw || '')
    .trim()
    .toUpperCase();
  if (!roll || !/^[A-Z0-9_-]{4,32}$/.test(roll)) {
    return res.status(400).json({ success: false, error: 'Valid roll number required' });
  }

  const allowed = await enforceLimits(res, [
    { key: `captcha:roll:${roll}`, max: 30, windowMs: WINDOW_MS },
    { key: `captcha:ip:${clientIp(req)}`, max: 300, windowMs: WINDOW_MS },
  ]);
  if (!allowed) return;

  try {
    const upstream = await portalFetchRetry(
      `${PORTAL_BASE}/captcha?roll=${encodeURIComponent(roll)}`,
      { method: 'GET', headers: { Accept: 'image/png,image/*,*/*' } },
      { retries: 1, timeoutMs: 45_000 }
    );
    if (!upstream.ok) {
      return res.status(upstream.status === 429 ? 429 : 502).json({
        success: false,
        error: 'Could not load captcha from portal',
      });
    }

    const attempt =
      upstream.headers.get('x-portal-attempt') || upstream.headers.get('X-Portal-Attempt') || '';
    if (!attempt) {
      return res.status(502).json({
        success: false,
        error: 'Portal captcha missing attempt id — check portal-backend deploy',
      });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'image/png';
    return res.status(200).json({
      success: true,
      attempt,
      contentType,
      imageBase64: buf.toString('base64'),
    });
  } catch {
    return res.status(504).json({
      success: false,
      error: 'Portal backend is waking up. Wait about a minute and try again.',
    });
  }
}
