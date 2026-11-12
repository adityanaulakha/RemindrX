/**
 * Optional same-origin proxy for portal login.
 * Browser can also call https://portal-backend-z9ce.onrender.com directly (CORS *).
 * Kept for future cookie/session isolation per RemindrX user.
 */
const UPSTREAM = 'https://portal-backend-z9ce.onrender.com/login';

export default async function handler(
  req: { method?: string; body?: { roll?: string; password?: string; captcha?: string } },
  res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (b: unknown) => void } }
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  const { roll, password, captcha } = req.body || {};
  if (!roll || !password || !captcha) {
    return res.status(400).json({ success: false, error: 'roll, password, and captcha are required' });
  }
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll, password, captcha }),
    });
    const json = await upstream.json();
    return res.status(upstream.status).json(json);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: err instanceof Error ? err.message : 'Upstream login failed',
    });
  }
}
