import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Post } from '../types';

/**
 * Dynamically calculates a user's Trust Score based on their posts,
 * then persists it to the user's Firestore document for leaderboard queries.
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
    snapshot.docs.forEach(d => {
      const post = d.data() as Post;
      
      if (post.status === 'verified') {
        score += 10;
      }
      
      // Calculate points based on interactions
      // Note: We might subtract 1 from confirmations because the creator auto-confirms their own post
      const otherConfirmations = Math.max(0, post.confirmations.length - (post.confirmations.includes(userId) ? 1 : 0));
      
      score += otherConfirmations;
      score -= post.disputes.length;
    });
    
    const finalScore = Math.max(0, score); // Prevent negative scores

    // Persist back to the user document so the Super Admin leaderboard can read it
    try {
      await updateDoc(doc(db, 'users', userId), { trustScore: finalScore });
    } catch (writeErr) {
      // Non-critical: if we can't write back (e.g. permissions), still return the computed score
      console.warn("Could not persist trust score to Firestore:", writeErr);
    }

    return finalScore;
  } catch (error) {
    console.error("Error calculating trust score:", error);
    return 0;
  }
}
