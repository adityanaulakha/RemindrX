import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
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

// eslint-disable-next-line react-refresh/only-export-components -- context hook lives with its provider
export const useAuth = () => useContext(AuthContext);

/** GLA portal custom-token users use uid `gla_{ROLL}` and skip email verification. */
// eslint-disable-next-line react-refresh/only-export-components -- tiny helper shared with Login
export function isPortalAuthUser(user: FirebaseUser): boolean {
  return user.uid.startsWith('gla_');
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unSubDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unSubDoc) {
        unSubDoc();
        unSubDoc = null;
      }

      const sessionOk = !!user && (isPortalAuthUser(user) || user.emailVerified);

      if (sessionOk && user) {
        const userDocRef = doc(db, 'users', user.uid);

        unSubDoc = onSnapshot(userDocRef, async (userDoc) => {
          if (userDoc.exists()) {
            const fetchedUser = { id: userDoc.id, ...userDoc.data() } as User;

            const updates: Record<string, unknown> = { lastActive: Date.now() };
            let needsUpdate = false;
            if (user.email && user.email !== fetchedUser.email) {
              updates.email = user.email;
              needsUpdate = true;
            }
            if (needsUpdate) {
              setDoc(userDocRef, updates, { merge: true }).catch(console.error);
            }

            setUserData(fetchedUser);
          } else {
            const newUser: User = {
              id: user.uid,
              name: user.displayName || 'New User',
              email: user.email || '',
              classId: null,
              role: 'student',
              trustScore: isPortalAuthUser(user) ? 100 : 0,
              createdAt: Date.now(),
              lastActive: Date.now(),
              authProvider: isPortalAuthUser(user) ? 'gla_portal' : 'email',
              rollNo: isPortalAuthUser(user) ? user.uid.replace(/^gla_/, '') : undefined,
              collegeId: isPortalAuthUser(user) ? 'gla' : undefined,
            };
            await setDoc(userDocRef, newUser);
            setUserData(newUser);
          }

          // Do not block first paint on the system notification prompt
          if ('Notification' in window && Notification.permission === 'default') {
            void Notification.requestPermission().catch((err) => {
              console.error('Failed to request notification permission', err);
            });
          }
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unSubDoc) unSubDoc();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, setUserData }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
