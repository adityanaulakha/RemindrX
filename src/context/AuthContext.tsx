import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { User } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  setUserData: (data: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  loading: true,
  setUserData: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user && user.emailVerified) {
        // Fetch custom user data from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let fetchedUser: User;
        if (userDoc.exists()) {
          fetchedUser = { id: userDoc.id, ...userDoc.data() } as User;
          
          // Auto-sync email and update lastActive
          const updates: any = { lastActive: Date.now() };
          if (user.email && user.email !== fetchedUser.email) {
            updates.email = user.email;
            fetchedUser.email = user.email;
          }
          setDoc(userDocRef, updates, { merge: true }).catch(console.error);
          
          setUserData(fetchedUser);
        } else {
          // If the user exists in Auth but not in Firestore, create a basic record
          const newUser: User = {
            id: user.uid,
            name: user.displayName || 'New User',
            email: user.email || '',
            classId: null,
            role: 'student',
            trustScore: 0,
            createdAt: Date.now(),
            lastActive: Date.now()
          };
          await setDoc(userDocRef, newUser);
          fetchedUser = newUser;
          setUserData(newUser);
        }

        // Request FCM Permissions immediately if supported
        if ('Notification' in window && Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
            // In a full implementation, we'd also call getToken(messaging) here 
            // and save the FCM token to the user's document for backend usage.
          } catch (err) {
            console.error('Failed to request notification permission', err);
          }
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, setUserData }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
