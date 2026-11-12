import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, deleteUser } from 'firebase/auth';
import { doc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { UserCircle, Lock, ShieldCheck, Repeat, Bell, Fingerprint, Mail, ShieldAlert } from 'lucide-react';
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
          toast.error('You are the last super admin. Add another super admin before deleting this account.');
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
      toast.error(error.message || 'Could not delete');
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

        let currentClassName = 'Unassigned';
        if (userData.classId) {
          try {
            const currentClassSnap = await getDocs(query(collection(db, 'classes'), where('__name__', '==', userData.classId)));
            if (!currentClassSnap.empty) {
              currentClassName = currentClassSnap.docs[0].data().name;
            }
          } catch (e) {
            console.error('Failed to get current class name', e);
          }
        }

        await addDoc(collection(db, 'class_change_requests'), {
          userId: currentUser.uid,
          userName: userData.name,
          currentClassId: userData.classId,
          currentClassName: currentClassName,            requestedClassId: targetClass.id,
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
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-card/40 border border-border p-5 sm:p-10 lg:p-16 shadow-sm">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Fingerprint className="h-64 w-64 text-primary" />
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-12 bg-primary rounded-full" />
                  <span className="text-xs font-semibold tracking-normal text-primary">Account</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-none pr-8">
                  Profile
                </h1>
              </div>

              <div className="flex items-center gap-6 p-6 rounded-2xl bg-muted border border-border shadow-inner">
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Trust Score</p>
                  <p className="text-3xl font-semibold text-primary">{trustScore}%</p>
                </div>
                <div className="h-12 w-px bg-muted" />
                <div className="h-16 w-16 rounded-2xl bg-primary-soft flex items-center justify-center border border-border">
                  <UserCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <h3 className="text-xs font-semibold tracking-normal text-muted-foreground flex items-center gap-2">
                    <UserCircle className="h-3 w-3" /> Your details
                  </h3>
                  <div className="space-y-6">
                    <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                    <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="College email" required />
                    <Input label="University Roll No" value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="Enter your roll number" required />
                    <Input label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-xs font-semibold tracking-normal text-muted-foreground flex items-center gap-2">
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

              <div className="pt-8 border-t border-border space-y-8">
                <h3 className="text-xs font-semibold tracking-normal text-muted-foreground flex items-center gap-2">
                  <Lock className="h-3 w-3" /> Security
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required for major changes" />
                  <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 chars" />
                </div>
              </div>

              <div className="pt-8 border-t border-border space-y-8">
                <h3 className="text-xs font-semibold tracking-normal text-muted-foreground flex items-center gap-2">
                  <Fingerprint className="h-3 w-3" /> Reminders
                </h3>
                <div className="space-y-4">
                  <label className="block text-xs font-medium text-muted-foreground ml-1">
                    Deadline window ({deadlinePreference} Days)
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
                    <div className="h-10 w-20 rounded-xl bg-muted border border-border flex items-center justify-center font-semibold text-primary">
                      {deadlinePreference}D
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Adjust how many days before a deadline a task should appear in your Dashboard's Alert section.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                 <Button type="button" variant="ghost" onClick={() => setIsClassChangeModalOpen(true)} className="rounded-2xl h-12 sm:h-14 px-6 sm:px-8 font-medium hover:bg-primary/10 hover:text-primary text-xs sm:text-xs">
                    <Repeat className="mr-2 h-4 w-4" /> Transfer Class
                 </Button>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Button type="submit" disabled={loading} className="h-12 sm:h-14 px-8 sm:px-12 rounded-2xl font-medium shadow-xl shadow-primary/20 text-xs sm:text-xs">
                      {loading ? 'Saving...' : 'Update Profile'}
                    </Button>
                  </div>
              </div>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-card/40 border border-border rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-2xl">
            <h2 className="text-2xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <Bell className="h-6 w-6 text-primary" /> Notifications
            </h2>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-8">
              Enable notifications for real-time updates on event approvals and class announcements.
            </p>
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-6">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <p className={`text-sm font-semibold ${Notification.permission === 'granted' ? 'text-success' : 'text-danger'}`}>
                      {Notification.permission === 'granted' ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${Notification.permission === 'granted' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {Notification.permission === 'granted' ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                  </div>
               </div>
               <Button 
                onClick={requestPermission} 
                disabled={Notification.permission === 'granted'}
                className="w-full h-12 rounded-xl font-medium text-xs shadow-lg shadow-primary/10"
               >
                 {Notification.permission === 'granted' ? 'Notifications Active' : 'Enable Notifications'}
               </Button>
            </div>
          </div>

          <div className="bg-card/40 border border-border rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-3 text-danger">
                <ShieldAlert className="h-6 w-6" /> Account Security
              </h2>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Irreversible deletion of your account from the RemindrX platform.
              </p>
            </div>
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full group p-6 rounded-2xl bg-danger/5 border border-danger/10 hover:bg-danger/10 transition-all text-left mt-8"
            >
              <div className="flex items-center justify-between">
                 <div className="space-y-1">
                    <p className="text-sm font-semibold text-danger">Delete Account</p>
                    <p className="text-xs font-medium opacity-40 tracking-normal">Permanent removal from the platform</p>
                 </div>
                 <ShieldAlert className="h-6 w-6 text-danger transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Account Deletion Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete account">
        <div className="space-y-8 p-2">
          <div className="bg-danger/10 p-6 rounded-2xl border border-danger/20 flex items-start gap-4">
            <ShieldAlert className="h-6 w-6 text-danger shrink-0 mt-1" />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-danger leading-none">Irreversible Action</h4>
              <p className="text-xs font-medium text-danger/80 leading-relaxed tracking-normal">
                This will permanently delete your profile, academic records, and access from the RemindrX platform.
              </p>
            </div>
          </div>

          <div className="space-y-4">
             <label className="flex items-start gap-4 p-4 rounded-2xl bg-muted border border-border cursor-pointer hover:bg-muted transition-colors">
               <input 
                 type="checkbox" 
                 className="mt-1 h-4 w-4 accent-danger" 
                 checked={deleteConfirm1}
                 onChange={(e) => setDeleteConfirm1(e.target.checked)}
               />
               <span className="text-xs font-semibold tracking-normal opacity-60">I understand that all my data will be permanently erased.</span>
             </label>

             <label className="flex items-start gap-4 p-4 rounded-2xl bg-muted border border-border cursor-pointer hover:bg-muted transition-colors">
               <input 
                 type="checkbox" 
                 className="mt-1 h-4 w-4 accent-danger" 
                 checked={deleteConfirm2}
                 onChange={(e) => setDeleteConfirm2(e.target.checked)}
               />
               <span className="text-xs font-semibold tracking-normal opacity-60">I confirm that this action cannot be undone.</span>
             </label>
          </div>

          <div className="space-y-4">
             <p className="text-xs font-semibold text-muted-foreground text-center">Verification Required</p>
             <Input 
               label="Current password" 
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
              className="flex-1 rounded-2xl h-14 bg-danger hover:bg-danger/90 text-white font-medium shadow-xl shadow-danger/20"
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
          <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
            <p className="text-xs font-medium text-foreground/60 leading-relaxed">
              A class transfer is sent to a super admin for approval. Check the destination section code before you submit.
            </p>
          </div>
          <Input
            label="Destination Class Code"
            placeholder="Section code"
            value={newClassCode}
            onChange={(e) => setNewClassCode(e.target.value)}
            required
          />
          <div className="pt-4 flex gap-4">
            <Button type="button" variant="ghost" className="flex-1 h-14 rounded-2xl font-medium" onClick={() => setIsClassChangeModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={classChangeLoading} className="flex-2 h-14 px-10 rounded-2xl font-medium shadow-xl shadow-primary/20">
              {classChangeLoading ? 'Processing...' : 'Submit Transfer'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
