import { auth } from '../firebase';

/** POST to a same-origin Vercel API route with the user's Firebase ID token. */
export async function callApi<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>
): Promise<T & { success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again');
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({ success: false, error: 'Bad server response' }))) as T & {
    success: boolean;
    error?: string;
  };
  if (!res.ok || !json.success) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export interface RosterStudent {
  id: string;
  name: string;
  rollNo: string;
  email: string;
  role: 'admin' | 'student';
  lastActive: number | null;
  trustScore: number;
}

export const crApi = {
  redeem: (code: string) => callApi<{ role: string; classId: string }>('/api/class/cr', { action: 'redeem', code }),
  demote: (userId: string) => callApi('/api/class/cr', { action: 'demote', userId }),
  roster: (classId?: string) =>
    callApi<{ classId: string; students: RosterStudent[] }>('/api/class/cr', { action: 'roster', classId }),
};
