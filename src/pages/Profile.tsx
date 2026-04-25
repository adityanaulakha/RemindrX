import { useState, useEffect } from 'react';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserCircle, Mail, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Profile() {
  const { currentUser, userData, setUserData } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userData && currentUser) {
      setName(userData.name || currentUser.displayName || '');
      setEmail(userData.email || currentUser.email || '');
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
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">Trust Score: {userData.trustScore}</span>
                </div>
              </div>
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
    </div>
  );
}
