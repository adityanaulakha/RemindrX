import { useState, useEffect } from 'react';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, updateDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { UserCircle, Lock, ShieldCheck, Repeat } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calculateTrustScore } from '../utils/trustScore';

export default function Profile() {
  const { currentUser, userData, setUserData } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustScore, setTrustScore] = useState(0);

  // Class Change State
  const [isClassChangeModalOpen, setIsClassChangeModalOpen] = useState(false);
  const [newClassCode, setNewClassCode] = useState('');
  const [classChangeLoading, setClassChangeLoading] = useState(false);

  useEffect(() => {
    if (userData && currentUser) {
      setName(userData.name || currentUser.displayName || '');
      setEmail(userData.email || currentUser.email || '');
      calculateTrustScore(currentUser.uid).then(setTrustScore);
    }
  }, [userData, currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData) return;
    
    setLoading(true);
    try {
      let requiresContextUpdate = false;
      const newUserData = { ...userData };

      const isEmailChanged = email !== currentUser.email;
      const isPasswordChanged = newPassword.length > 0;

      // Re-authenticate if changing sensitive data
      if (isEmailChanged || isPasswordChanged) {
        if (!currentPassword) {
          toast.error('Please enter your Current Password to change your email or password.');
          setLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // Update Name
      if (name !== userData.name) {
        await updateProfile(currentUser, { displayName: name });
        await updateDoc(doc(db, 'users', currentUser.uid), { name });
        newUserData.name = name;
        requiresContextUpdate = true;
      }

      // Update Email
      if (isEmailChanged) {
        await verifyBeforeUpdateEmail(currentUser, email);
        toast.success(`Verification link sent to ${email}. Check your inbox to complete the change!`, { duration: 6000 });
        setEmail(currentUser.email || ''); // Revert UI until verified
        // We do NOT update Firestore here to prevent getting out of sync with Auth
      }

      // Update Password
      if (isPasswordChanged) {
        await updatePassword(currentUser, newPassword);
      }

      if (requiresContextUpdate) {
        setUserData(newUserData);
      }

      toast.success('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        toast.error('Incorrect current password.');
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error('For security reasons, please log out and log back in.');
      } else {
        toast.error(error.message || 'Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClassChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData || !newClassCode.trim()) return;

    setClassChangeLoading(true);
    try {
      // 1. Check if class exists
      const classQ = query(collection(db, 'classes'), where('joinCode', '==', newClassCode.trim().toUpperCase()));
      const classSnap = await getDocs(classQ);
      
      if (classSnap.empty) {
        toast.error('Class code not found. Please check and try again.');
        setClassChangeLoading(false);
        return;
      }

      const targetClass = classSnap.docs[0];

      if (targetClass.id === userData.classId) {
        toast.error('You are already in this class!');
        setClassChangeLoading(false);
        return;
      }

      // 2. Check if a pending request already exists
      const existingReqQ = query(
        collection(db, 'class_change_requests'), 
        where('userId', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const existingReqSnap = await getDocs(existingReqQ);
      if (!existingReqSnap.empty) {
        toast.error('You already have a pending class change request.');
        setClassChangeLoading(false);
        return;
      }

      // 3. Create Request
      await addDoc(collection(db, 'class_change_requests'), {
        userId: currentUser.uid,
        userName: userData.name,
        currentClassId: userData.classId,
        requestedClassId: targetClass.id,
        requestedClassCode: targetClass.data().joinCode,
        requestedClassName: targetClass.data().name,
        status: 'pending',
        createdAt: Date.now()
      });

      toast.success('Class change request submitted successfully!');
      setIsClassChangeModalOpen(false);
      setNewClassCode('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setClassChangeLoading(false);
    }
  };

  if (!userData) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-foreground/60">Manage your personal information and security.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" /> Profile Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary text-2xl font-bold">
                {userData.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h3 className="text-xl font-bold">{userData.name}</h3>
                <p className="text-sm text-foreground/60">{userData.role === 'admin' ? 'Class Representative' : 'Student'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">Trust Score: {trustScore}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => setIsClassChangeModalOpen(true)}
              >
                <Repeat className="h-4 w-4" /> Request Class Change
              </Button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2 text-foreground/80">
                  <Lock className="h-4 w-4" /> Security
                </h4>
                <div className="space-y-4">
                  <Input
                    label="Current Password (Required for Email/Password changes)"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    minLength={6}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving Changes...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={isClassChangeModalOpen} onClose={() => setIsClassChangeModalOpen(false)} title="Request Class Change">
        <form onSubmit={handleClassChangeRequest} className="space-y-4">
          <p className="text-sm text-foreground/70 mb-4">
            If you joined the wrong class, you can request a transfer. Your request will need to be approved by a Super Admin.
          </p>
          <Input
            label="New Section Code"
            type="text"
            placeholder="e.g. CS2024"
            value={newClassCode}
            onChange={(e) => setNewClassCode(e.target.value)}
            required
          />
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsClassChangeModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={classChangeLoading}>
              {classChangeLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
