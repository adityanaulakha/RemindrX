/**
 * Legacy finance-token refresh proxy (GLA native app).
 * Attendance now uses reminder-backend-cf51.onrender.com session + /dashboard.
 * Kept for reference; prefer portal.ts client.
 */
export default async function handler(
  _req: { method?: string },
  res: { status: (n: number) => { json: (b: unknown) => void } }
) {
  return res.status(410).json({
    status: 410,
    message: 'Deprecated. Use portal-backend /dashboard session (see src/services/gla/portal.ts).',
    data: null,
  });
}
