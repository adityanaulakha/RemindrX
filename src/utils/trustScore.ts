import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import type { Post } from '../types';

/**
 * Trust score for one author, from their posts in their own section:
 *   +10 per verified post, +1 per confirmation from others, -1 per dispute.
 * Read-only on the client. The persisted `users.trustScore` is server-owned
 * (written by /api/class/roster), so students can't inflate it.
 */
export function scorePosts(posts: Pick<Post, 'status' | 'confirmations' | 'disputes' | 'createdBy'>[]): number {
  let score = 0;
  for (const post of posts) {
    if (post.status === 'verified') score += 10;
    const confirmations = post.confirmations || [];
    const disputes = post.disputes || [];
    score += confirmations.filter((id) => id !== post.createdBy).length;
    score -= disputes.length;
  }
  return Math.max(0, score);
}

export async function calculateTrustScore(userId: string, classId: string | null | undefined): Promise<number> {
  if (!classId) return 0;
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'posts'),
        where('classId', '==', classId),
        where('createdBy', '==', userId),
        limit(300)
      )
    );
    return scorePosts(snapshot.docs.map((d) => d.data() as Post));
  } catch (error) {
    console.error('Error calculating trust score:', error);
    return 0;
  }
}
