import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, increment } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { ClassData } from '../types';

export default function JoinClass() {
  const navigate = useNavigate();
  const { userData, currentUser, setUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [adminCode, setAdminCode] = useState('');

  // Redirect if already in a class
  useEffect(() => {
    if (userData?.classId) {
      navigate('/dashboard');
    }
  }, [userData, navigate]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData) return;
    
    setLoading(true);

    try {
      // 1. Find the class with the given joinCode
      const q = query(collection(db, 'classes'), where('joinCode', '==', classCode.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error('Invalid Class Code. Please check and try again.');
        setLoading(false);
        return;
      }

      const classDoc = querySnapshot.docs[0];
      const classData = classDoc.data() as ClassData;
      let newRole: 'student' | 'admin' = 'student';

      // 2. Process Admin Code if provided
      if (adminCode.trim()) {
        if (classData.adminInviteCode === adminCode.trim()) {
          if (classData.adminCodeUses > 0) {
            // Check expiry if it exists
            if (classData.adminCodeExpiry && classData.adminCodeExpiry < Date.now()) {
              toast.error('Admin invite code has expired.');
              setLoading(false);
              return;
            }
            newRole = 'admin';
            
            // Decrement uses and add admin to list
            await updateDoc(classDoc.ref, {
              adminCodeUses: increment(-1),
              admins: arrayUnion(currentUser.uid)
            });
            toast.success('Successfully joined as Admin!');
          } else {
            toast.error('Admin invite code usage limit reached.');
            setLoading(false);
            return;
          }
        } else {
          toast.error('Invalid Admin Invite Code.');
          setLoading(false);
          return;
        }
      } else {
        toast.success(`Successfully joined ${classData.name}!`);
      }

      // 3. Update the User's document
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        classId: classDoc.id,
        role: newRole,
      });

      // Update local context
      setUserData({
        ...userData,
        classId: classDoc.id,
        role: newRole,
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to join class.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Join a Class</h1>
          <p className="text-sm text-foreground/60">
            Enter your class code to get started. If you are a Class Rep, enter your admin invite code as well.
          </p>
        </div>

        <form onSubmit={handleJoinClass} className="space-y-4">
          <Input
            label="Class Code *"
            type="text"
            placeholder="e.g. CS2024"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            required
          />
          <Input
            label="Admin Invite Code (Optional)"
            type="text"
            placeholder="For Class Reps only"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
          />

          <Button type="submit" className="w-full mt-6" disabled={loading} size="lg">
            {loading ? 'Verifying...' : 'Join Class'}
          </Button>
        </form>
      </div>
    </div>
  );
}
