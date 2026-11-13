/**
 * Portal-backend keep-alive + cold-start failsafe.
 *
 * Render is pinged ~every 14 minutes so the free instance usually stays warm.
 * If it still sleeps (missed ping, deploy, crash), the first request can take
 * ~30–60s — we retry transient failures instead of forcing an immediate re-login.
 */

/** Matches the self-ping cadence (ping every 14 min < Render’s 15 min idle). */
export const PORTAL_KEEP_ALIVE_MS = 14 * 60 * 1000;

/** Extra headroom for a cold boot after an unexpected spin-down. */
export const PORTAL_COLD_START_TIMEOUT_MS = 60_000;

/** When the portal responded recently, fail faster instead of waiting a full cold boot. */
export const PORTAL_WARM_TIMEOUT_MS = 12_000;

const COLD_RETRY_DELAYS_MS = [0, 2_500, 6_000] as const;
const WARM_RETRY_DELAYS_MS = [0, 1_500] as const;

let lastPortalOkAt = 0;

export function markPortalOk(): void {
  lastPortalOkAt = Date.now();
}

export function isPortalWarm(now = Date.now()): boolean {
  return lastPortalOkAt > 0 && now - lastPortalOkAt < PORTAL_KEEP_ALIVE_MS;
}

export function isTransientPortalStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 521 || status === 522 || status === 524;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export type PortalRetryHook = (info: { attempt: number; maxAttempts: number }) => void;

/**
 * fetch() with retries on network errors and gateway/cold-start statuses.
 * Non-transient responses (4xx, 200) return immediately.
 * Warm path: shorter timeout + fewer retries when the portal succeeded recently.
 */
export async function portalFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { retries?: number; onRetry?: PortalRetryHook }
): Promise<Response> {
  const warm = isPortalWarm();
  const delays = warm ? WARM_RETRY_DELAYS_MS : COLD_RETRY_DELAYS_MS;
  const timeoutMs = warm ? PORTAL_WARM_TIMEOUT_MS : PORTAL_COLD_START_TIMEOUT_MS;
  const maxExtra = opts?.retries ?? (warm ? 1 : 2);
  const maxAttempts = Math.min(maxExtra + 1, delays.length);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      opts?.onRetry?.({ attempt, maxAttempts });
      const delay = delays[Math.min(attempt, delays.length - 1)] ?? 6_000;
      await sleep(delay);
    }

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      const userSignal = init?.signal;
      const onAbort = () => controller.abort();
      userSignal?.addEventListener('abort', onAbort);

      let res: Response;
      try {
        res = await fetch(input, {
          ...init,
          cache: init?.cache ?? 'no-store',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
        userSignal?.removeEventListener('abort', onAbort);
      }

      if (res.ok) markPortalOk();

      if (res.ok || !isTransientPortalStatus(res.status) || attempt === maxAttempts - 1) {
        return res;
      }
      lastError = new Error(`Portal HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts - 1) throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Portal request failed');
}
