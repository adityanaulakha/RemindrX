import { useState, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, messaging } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

// IMPORTANT: Replace this with your actual VAPID key from Firebase Console
// Project Settings -> Cloud Messaging -> Web configuration -> Web Push certificates
const VAPID_KEY = 'YOUR_PUBLIC_VAPID_KEY_HERE';

export function useNotifications() {
  const { currentUser } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  const requestPermission = async () => {
    if (!messaging || !currentUser) return;

    try {
      if (VAPID_KEY === 'YOUR_PUBLIC_VAPID_KEY_HERE') {
        toast.error('Developer Action Required: VAPID Key is missing in useNotifications.tsx');
        console.error('VAPID Key not configured. Please see project documentation.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          setToken(currentToken);
          // Save token to user document
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(currentToken)
          });
          console.log('Notification token registered');
        }
      } else {
        console.warn('Notification permission denied');
      }
    } catch (error) {
      console.error('Error getting notification token:', error);
    }
  };

  useEffect(() => {
    if (messaging) {
      // Handle foreground messages
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        toast(
          (t) => (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-primary">{payload.notification?.title}</span>
              <span className="text-sm">{payload.notification?.body}</span>
            </div>
          ),
          { duration: 5000, icon: '🔔' }
        );
      });

      return () => unsubscribe();
    }
  }, []);

  return { requestPermission, token };
}
