import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, deleteUser } from 'firebase/auth';
import { doc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { UserCircle, Lock, ShieldCheck, Repeat, Bell, Fingerprint, Mail, ShieldAlert, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calculateTrustScore } from '../utils/trustScore';
import { useNotifications } from '../hooks/useNotifications';

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, userData, setUserData } = useAuth();
  const { requestPermission } = useNotifications();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustScore, setTrustScore] = useState(0);
  const [deadlinePreference, setDeadlinePreference] = useState(2);
  const [dob, setDob] = useState('');
  const [section, setSection] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [year, setYear] = useState('');
  const [program, setProgram] = useState('');
  const [branch, setBranch] = useState('');

  // Class Change State
  const [isClassChangeModalOpen, setIsClassChangeModalOpen] = useState(false);
  const [newClassCode, setNewClassCode] = useState('');
  const [classChangeLoading, setClassChangeLoading] = useState(false);
  
  // Account Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirm1, setDeleteConfirm1] = useState(false);
  const [deleteConfirm2, setDeleteConfirm2] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function loadProfileData() {
      if (userData && currentUser) {
        setName(userData.name || currentUser.displayName || '');
        setEmail(userData.email || currentUser.email || '');
        setDeadlinePreference(userData.deadlinePreference || 2);
        setDob(userData.dob || '');
        setSection(userData.section || '');
        setRollNo(userData.rollNo || '');
        setYear(userData.year || '');
        setProgram(userData.program || '');
        setBranch(userData.branch || '');
        calculateTrustScore(currentUser.uid).then(setTrustScore);

        // Auto-capture class details if available
        if (userData.classId) {
          try {
            const classRef = doc(db, 'classes', userData.classId);
            const classSnap = await getDocs(query(collection(db, 'classes'), where('__name__', '==', userData.classId)));
            if (!classSnap.empty) {
              const classData = classSnap.docs[0].data();
              if (classData.year && !userData.year) setYear(classData.year);
              if (classData.section && !userData.section) setSection(classData.section);
              if (classData.program && !userData.program) setProgram(classData.program);
              if (classData.branch && !userData.branch) setBranch(classData.branch);
            }
          } catch (e) {
            console.error("Failed to fetch class details", e);
          }
        }
      }
    }
    loadProfileData();
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

      if (isEmailChanged || isPasswordChanged) {
        if (!currentPassword) {
          toast.error('Authentication Required');
          setLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      const updates: any = {};
      if (name !== userData.name) {
        await updateProfile(currentUser, { displayName: name });
        updates.name = name;
        newUserData.name = name;
        requiresContextUpdate = true;
      }
      if (deadlinePreference !== userData.deadlinePreference) {
        updates.deadlinePreference = deadlinePreference;
        newUserData.deadlinePreference = deadlinePreference;
        requiresContextUpdate = true;
      }
      if (dob !== userData.dob) {
        updates.dob = dob;
        newUserData.dob = dob;
        requiresContextUpdate = true;
      }
      if (rollNo !== userData.rollNo) {
        updates.rollNo = rollNo;
        newUserData.rollNo = rollNo;
        requiresContextUpdate = true;
      }
      // Read-only fields from class (failsafe)
      if (year !== userData.year) {
        updates.year = year;
        newUserData.year = year;
        requiresContextUpdate = true;
      }
      if (section !== userData.section) {
        updates.section = section;
        newUserData.section = section;
        requiresContextUpdate = true;
      }
      if (program !== userData.program) {
        updates.program = program;
        newUserData.program = program;
        requiresContextUpdate = true;
      }
      if (branch !== userData.branch) {
        updates.branch = branch;
        newUserData.branch = branch;
        requiresContextUpdate = true;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', currentUser.uid), updates);
      }

      if (isEmailChanged) {
        await verifyBeforeUpdateEmail(currentUser, email);
        toast.success(`Verification broadcasted to ${email}`, { duration: 6000 });
        setEmail(currentUser.email || '');
      }

      if (isPasswordChanged) {
        await updatePassword(currentUser, newPassword);
      }

      if (requiresContextUpdate) setUserData(newUserData);

      toast.success('Profile updated');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Profile update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPulse = async () => {
    if (!currentUser) return;
    
    try {
      // 1. Add to Firestore Notifications (for Inbox)
      await addDoc(collection(db, 'notifications'), {
        userId: currentUser.uid,
        title: 'System Test: Pulse Active',
        message: 'This is a test transmission to verify your notification sync.',
        type: 'system_test',
        createdAt: Date.now(),
        read: false
      });

      // 2. Local Browser Notification
      if (Notification.permission === 'granted') {
        new Notification('RemindrX Pulse', {
          body: 'System sync verified. You are now receiving transmissions.',
          icon: '/Cropped.png'
        });
      }

      toast.success('Test pulse sent!');
    } catch (error) {
      toast.error('Test pulse failed');
    }
  };

  const handleAccountDelete = async () => {
    if (!currentUser || !userData || !currentPassword) {
      toast.error('Authentication Required');
      return;
    }

    if (!deleteConfirm1 || !deleteConfirm2) {
      toast.error('Please verify both safety checks');
      return;
    }

    setDeleteLoading(true);
    try {
      // 1. Failsafe for Super Admins
      if (userData.isSuperAdmin) {
        const q = query(collection(db, 'users'), where('isSuperAdmin', '==', true));
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
        
        if (count <= 1) {
          toast.error('Protocol Denied: You are the last Super Admin. Appoint a successor before termination.');
          setDeleteLoading(false);
          return;
        }
      }

      // 2. Re-authenticate
      const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 3. Delete Firestore Document
      await deleteDoc(doc(db, 'users', currentUser.uid));

      // 4. Delete Firebase Auth User
      await deleteUser(currentUser);

      toast.success('Account purged from matrix');
      navigate('/login');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Purge failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClassChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData || !newClassCode.trim()) return;

    setClassChangeLoading(true);
    try {
      const classQ = query(collection(db, 'classes'), where('joinCode', '==', newClassCode.trim().toUpperCase()));
      const classSnap = await getDocs(classQ);
      
      if (classSnap.empty) {
        toast.error('Sector not found');
        return;
      }

      const targetClass = classSnap.docs[0];
      const existingReqQ = query(
        collection(db, 'class_change_requests'), 
        where('userId', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const existingReqSnap = await getDocs(existingReqQ);

      if (!existingReqSnap.empty) {
        toast.error('Request already in queue');
        return;
      }

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

      toast.success('Transfer request queued');
      setIsClassChangeModalOpen(false);
      setNewClassCode('');
    } catch (error: any) {
      toast.error('Request failed');
    } finally {
      setClassChangeLoading(false);
    }
  };

  if (!userData) return null;

  return (
    <>
      <div className="space-y-12 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative overflow-hidden rounded-[3.5rem] bg-card/40 backdrop-blur-3xl border border-white/10 p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Fingerprint className="h-64 w-64 text-primary" />
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-12 bg-primary rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">Identity Profile</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
                  User Profile
                </h1>
              </div>

              <div className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-white/5 border border-white/5 shadow-inner">
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-1">Trust Score</p>
                  <p className="text-3xl font-black italic text-primary">{trustScore}%</p>
                </div>
                <div className="h-12 w-px bg-white/10" />
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-white/5">
                  <UserCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/40 flex items-center gap-2">
                    <UserCircle className="h-3 w-3" /> Core Identity
                  </h3>
                  <div className="space-y-6">
                    <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your identity" required />
                    <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
                    <Input label="University Roll No" value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="Enter your roll number" required />
                    <Input label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/40 flex items-center gap-2">
                    <Repeat className="h-3 w-3" /> Academic Details
                  </h3>
                  <div className="space-y-6">
                    <Input label="Academic Year" value={year} disabled className="opacity-50 cursor-not-allowed bg-muted/5" />
                    <Input label="Assigned Section" value={section} disabled className="opacity-50 cursor-not-allowed bg-muted/5" />
                    <Input label="Program" value={program} disabled className="opacity-50 cursor-not-allowed bg-muted/5" />
                    <Input label="Branch" value={branch} disabled className="opacity-50 cursor-not-allowed bg-muted/5" />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/40 flex items-center gap-2">
                  <Lock className="h-3 w-3" /> Security
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required for major changes" />
                  <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 chars" />
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/40 flex items-center gap-2">
                  <Fingerprint className="h-3 w-3" /> System Preferences
                </h3>
                <div className="space-y-4">
                  <label className="block text-xs font-black uppercase tracking-widest text-foreground/40 ml-1 italic">
                    Deadline Dashboard Presence ({deadlinePreference} Days)
                  </label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="1" 
                      max="7" 
                      value={deadlinePreference} 
                      onChange={(e) => setDeadlinePreference(parseInt(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <div className="h-10 w-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black italic text-primary">
                      {deadlinePreference}D
                    </div>
                  </div>
                  <p className="text-[9px] font-medium text-foreground/30 italic">
                    Adjust how many days before a deadline a task should appear in your Dashboard's Alert section.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                 <Button type="button" variant="ghost" onClick={() => setIsClassChangeModalOpen(true)} className="rounded-2xl h-14 px-8 font-black uppercase tracking-widest italic hover:bg-primary/10 hover:text-primary">
                    <Repeat className="mr-2 h-4 w-4" /> Transfer Class
                 </Button>
                  <div className="flex gap-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleTestPulse}
                      className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest italic border-primary/20 text-primary hover:bg-primary/5"
                    >
                      <Zap className="h-4 w-4 mr-2" /> Test Notifications
                    </Button>
                    <Button type="submit" disabled={loading} className="h-14 px-12 rounded-2xl font-black uppercase tracking-widest italic shadow-xl shadow-primary/20">
                      {loading ? 'Saving...' : 'Update Profile'}
                    </Button>
                  </div>
              </div>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-card/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 shadow-2xl">
            <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-6 flex items-center gap-3">
              <Bell className="h-6 w-6 text-primary" /> Notifications
            </h2>
            <p className="text-sm font-medium text-foreground/40 leading-relaxed mb-8">
              Enable notifications for real-time updates on event approvals and class announcements.
            </p>
            <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-6">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Status</p>
                    <p className={`text-sm font-black italic uppercase ${Notification.permission === 'granted' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {Notification.permission === 'granted' ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${Notification.permission === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {Notification.permission === 'granted' ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                  </div>
               </div>
               <Button 
                onClick={requestPermission} 
                disabled={Notification.permission === 'granted'}
                className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] italic shadow-lg shadow-primary/10"
               >
                 {Notification.permission === 'granted' ? 'Notifications Active' : 'Enable Notifications'}
               </Button>
            </div>
          </div>

          <div className="bg-card/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-2xl font-black tracking-tighter italic uppercase flex items-center gap-3 text-danger">
                <ShieldAlert className="h-6 w-6" /> Account Security
              </h2>
              <p className="text-sm font-medium text-foreground/40 leading-relaxed">
                Irreversible deletion of your account from the RemindrX platform.
              </p>
            </div>
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full group p-6 rounded-[2rem] bg-danger/5 border border-danger/10 hover:bg-danger/10 transition-all text-left mt-8"
            >
              <div className="flex items-center justify-between">
                 <div className="space-y-1">
                    <p className="text-sm font-black italic uppercase text-danger">Delete Account</p>
                    <p className="text-[10px] font-medium opacity-40 uppercase tracking-widest">Permanent removal from the platform</p>
                 </div>
                 <ShieldAlert className="h-6 w-6 text-danger group-hover:scale-110 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Account Deletion Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Security Protocol: Deletion">
        <div className="space-y-8 p-2">
          <div className="bg-danger/10 p-6 rounded-[2rem] border border-danger/20 flex items-start gap-4">
            <ShieldAlert className="h-6 w-6 text-danger shrink-0 mt-1" />
            <div className="space-y-2">
              <h4 className="text-sm font-black italic uppercase text-danger leading-none">Irreversible Action</h4>
              <p className="text-[11px] font-medium text-danger/80 leading-relaxed uppercase tracking-wider">
                This will permanently delete your profile, academic records, and access from the RemindrX platform.
              </p>
            </div>
          </div>

          <div className="space-y-4">
             <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
               <input 
                 type="checkbox" 
                 className="mt-1 h-4 w-4 accent-danger" 
                 checked={deleteConfirm1}
                 onChange={(e) => setDeleteConfirm1(e.target.checked)}
               />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 italic">I understand that all my data will be permanently erased.</span>
             </label>

             <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
               <input 
                 type="checkbox" 
                 className="mt-1 h-4 w-4 accent-danger" 
                 checked={deleteConfirm2}
                 onChange={(e) => setDeleteConfirm2(e.target.checked)}
               />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 italic">I confirm that this action cannot be undone.</span>
             </label>
          </div>

          <div className="space-y-4">
             <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 italic text-center">Verification Required</p>
             <Input 
               label="Current Access Key (Password)" 
               type="password" 
               value={currentPassword} 
               onChange={(e) => setCurrentPassword(e.target.value)} 
               placeholder="Enter password to proceed"
               required
             />
          </div>

          <div className="flex gap-4">
            <Button variant="ghost" className="flex-1 rounded-2xl h-14" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="flex-1 rounded-2xl h-14 bg-danger hover:bg-danger/90 text-white font-black italic uppercase tracking-widest shadow-xl shadow-danger/20"
              disabled={!deleteConfirm1 || !deleteConfirm2 || !currentPassword || deleteLoading}
              onClick={handleAccountDelete}
            >
              {deleteLoading ? 'Deleting...' : 'Confirm Deletion'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sector Transfer Modal */}
      <Modal isOpen={isClassChangeModalOpen} onClose={() => setIsClassChangeModalOpen(false)} title="Class Transfer Request">
        <form onSubmit={handleClassChangeRequest} className="space-y-8 py-4">
          <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10">
            <p className="text-xs font-medium text-foreground/60 leading-relaxed italic">
              "Initiating class transfer will queue your request for Super Admin verification. Ensure the destination class code is accurate."
            </p>
          </div>
          <Input
            label="Destination Class Code"
            placeholder="e.g. CS2024"
            value={newClassCode}
            onChange={(e) => setNewClassCode(e.target.value)}
            required
          />
          <div className="pt-4 flex gap-4">
            <Button type="button" variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest italic" onClick={() => setIsClassChangeModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={classChangeLoading} className="flex-2 h-14 px-10 rounded-2xl font-black uppercase tracking-widest italic shadow-xl shadow-primary/20">
              {classChangeLoading ? 'Processing...' : 'Submit Transfer'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
