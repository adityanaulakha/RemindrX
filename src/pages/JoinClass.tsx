import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, increment } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import type { ClassData } from '../types';

export default function JoinClass() {
  const navigate = useNavigate();
  const { userData, currentUser, setUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [dob, setDob] = useState(userData?.dob || '');

  useEffect(() => {
    if (userData?.classId) {
      navigate('/dashboard');
    }
  }, [userData, navigate]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData) return;
    if (!dob) {
      toast.error('Please enter your Date of Birth');
      return;
    }

    setLoading(true);

    try {
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

      if (adminCode.trim()) {
        if (classData.adminInviteCode === adminCode.trim()) {
          if (classData.adminCodeUses > 0) {
            if (classData.adminCodeExpiry && classData.adminCodeExpiry < Date.now()) {
              toast.error('Admin invite code has expired.');
              setLoading(false);
              return;
            }
            newRole = 'admin';

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

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        classId: classDoc.id,
        role: newRole,
        program: classData.program || '',
        branch: classData.branch || '',
        year: classData.year || '',
        section: classData.section || '',
        dob: dob
      });

      setUserData({
        ...userData,
        classId: classDoc.id,
        role: newRole,
        program: classData.program || '',
        branch: classData.branch || '',
        year: classData.year || '',
        section: classData.section || '',
        dob: dob
      });

      navigate('/dashboard?firstTime=true');
    } catch (error: any) {
      toast.error(error.message || 'Failed to join class.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-canvas flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card/80 p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8 page-enter">
        <div className="space-y-2 text-center">
          <Badge tone="primary">One last step</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Join your section</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enter the section code from your class representative. Class reps can also add their invite code.
          </p>
        </div>

        <form onSubmit={handleJoinClass} className="space-y-4">
          <Input
            label="Date of Birth *"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
          />
          <Input
            label="Section Code *"
            type="text"
            placeholder="Section code"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            required
          />
          <Input
            label="Admin Invite Code (Optional)"
            type="text"
            placeholder="Only if you are a class rep"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
          />
          <Button type="submit" className="mt-2 w-full" disabled={loading} size="lg">
            {loading ? 'Verifying…' : 'Join class'}
          </Button>
        </form>
      </div>
    </div>
  );
}
