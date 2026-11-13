import type { PostStatus } from '../types';

/** Minimum classmate confirmations (with zero disputes) to auto-verify. */
export const VERIFY_CONFIRMATIONS = 3;

/**
 * Single source of truth for post verification status; mirrored by
 * `statusIsHonest()` in firestore.rules.
 */
export function computePostStatus(
  confirmations: string[],
  disputes: string[],
  actorIsClassRepConfirming = false
): PostStatus {
  if (actorIsClassRepConfirming && disputes.length === 0) return 'verified';
  if (disputes.length > confirmations.length) return 'unverified';
  if (confirmations.length >= VERIFY_CONFIRMATIONS && disputes.length === 0) return 'verified';
  if (confirmations.length > 0) return 'likely';
  return 'unverified';
}

/** Toggle the current user's confirm/dispute vote on a post. */
export function toggleVote(
  post: { confirmations: string[]; disputes: string[] },
  uid: string,
  type: 'confirm' | 'dispute'
): { confirmations: string[]; disputes: string[] } {
  const confirmations = post.confirmations.filter((id) => id !== uid);
  const disputes = post.disputes.filter((id) => id !== uid);
  if (type === 'confirm' && !post.confirmations.includes(uid)) confirmations.push(uid);
  if (type === 'dispute' && !post.disputes.includes(uid)) disputes.push(uid);
  return { confirmations, disputes };
}
