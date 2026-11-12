/**
 * Client-side captcha load gate: toast + 10s cooldown to avoid hammering portal /captcha.
 */

const COOLDOWN_MS = 10_000;

let lastCaptchaAt = 0;

export function captchaCooldownRemainingMs(now = Date.now()): number {
  const elapsed = now - lastCaptchaAt;
  if (lastCaptchaAt === 0 || elapsed >= COOLDOWN_MS) return 0;
  return COOLDOWN_MS - elapsed;
}

export function canLoadCaptcha(now = Date.now()): boolean {
  return captchaCooldownRemainingMs(now) === 0;
}

export function markCaptchaRequested(now = Date.now()): void {
  lastCaptchaAt = now;
}

export function captchaCooldownSecondsLeft(now = Date.now()): number {
  return Math.ceil(captchaCooldownRemainingMs(now) / 1000);
}

export const CAPTCHA_COOLDOWN_MS = COOLDOWN_MS;
