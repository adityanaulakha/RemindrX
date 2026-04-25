import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Post } from '../types';

/**
 * Dynamically calculates a user's Trust Score based on their posts.
 * Trust Score is calculated as:
 * +10 points for each 'verified' post
 * +1 point for each confirmation received
 * -1 point for each dispute received
 */
export async function calculateTrustScore(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'posts'), where('createdBy', '==', userId));
    const snapshot = await getDocs(q);
    
    let score = 0;
    snapshot.docs.forEach(doc => {
      const post = doc.data() as Post;
      
      if (post.status === 'verified') {
        score += 10;
      }
      
      // Calculate points based on interactions
      // Note: We might subtract 1 from confirmations because the creator auto-confirms their own post
      const otherConfirmations = Math.max(0, post.confirmations.length - (post.confirmations.includes(userId) ? 1 : 0));
      
      score += otherConfirmations;
      score -= post.disputes.length;
    });
    
    return Math.max(0, score); // Prevent negative scores
  } catch (error) {
    console.error("Error calculating trust score:", error);
    return 0;
  }
}
