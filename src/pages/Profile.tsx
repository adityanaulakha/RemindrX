import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  deleteUser,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  deleteDoc,
  getCountFromServer,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import {
  UserCircle,
  Lock,
  ShieldCheck,
  Bell,
  ShieldAlert,
  Fingerprint,
  GraduationCap,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calculateTrustScore } from '../utils/trustScore';
import { useNotifications } from '../hooks/useNotifications';
import { crApi } from '../services/api';
import { refreshPortalProvision } from '../services/gla/portal';
import { loadMeta } from '../services/gla/session';

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, userData, setUserData } = useAuth();
  const { requestPermission } = useNotifications();
  const isPortalUser = userData?.authProvider === 'gla_portal' || currentUser?.uid.startsWith('gla_');

  const [portalSyncing, setPortalSyncing] = useState(false);
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
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');

  const [crInviteCode, setCrInviteCode] = useState('');
  const [crLoading, setCrLoading] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirm1, setDeleteConfirm1] = useState(false);
  const [deleteConfirm2, setDeleteConfirm2] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    async function loadProfileData() {
      if (userData && currentUser) {
        setName(userData.name || currentUser.displayName || '');
        setEmail(userData.email || currentUser.email || '');
        setDeadlinePreference(userData.deadlinePreference || 2);
        // type="date" requires YYYY-MM-DD — Safari throws "string did not match expected pattern" otherwise
        const rawDob = userData.dob || '';
        setDob(/^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? rawDob : '');
        setSection(userData.section || '');
        setRollNo(userData.rollNo || '');
        setYear(userData.year || '');
        setProgram(userData.program || '');
        setBranch(userData.branch || '');
        setCourse(userData.course || userData.program || '');
        setSemester(userData.semester || '');
        calculateTrustScore(currentUser.uid, userData.classId).then(setTrustScore);

        if (userData.classId) {
          try {
            const classSnap = await getDoc(doc(db, 'classes', userData.classId));
            if (classSnap.exists()) {
              const classData = classSnap.data();
              if (classData.year && !userData.year) setYear(classData.year);
              if (classData.section && !userData.section) setSection(classData.section);
              if (classData.program && !userData.program) setProgram(classData.program);
              if (classData.branch && !userData.branch) setBranch(classData.branch);
            }
          } catch (e) {
            console.error('Failed to fetch class details', e);
          }
        }
      }
    }
    loadProfileData();
  }, [userData, currentUser]);

  const handleSyncFromPortal = async () => {
    if (!currentUser || !isPortalUser) return;
    const portalSession = loadMeta().token;
    if (!portalSession) {
      toast.error('Open Attendance and reconnect once, then sync again');
      return;
    }
    setPortalSyncing(true);
    try {
      const idToken = await currentUser.getIdToken();
      const result = await refreshPortalProvision(idToken, portalSession);
      if (!result.success) {
        toast.error(result.error || 'Could not sync from portal');
        return;
      }
      const p = result.profile;
      if (p) {
        if (p.name) setName(p.name);
        if (p.dob) setDob(String(p.dob));
        if (p.course || p.program) setCourse(String(p.course || p.program || ''));
        if (p.program || p.course) setProgram(String(p.program || p.course || ''));
        if (p.branch) setBranch(String(p.branch));
        if (p.year) setYear(String(p.year));
        if (p.section) setSection(String(p.section).toUpperCase());
        if (p.semester) setSemester(String(p.semester));
        if (userData) {
          setUserData({
            ...userData,
            name: p.name || userData.name,
            dob: p.dob != null ? String(p.dob) : userData.dob,
            course: (p.course || p.program || userData.course) as string | undefined,
            program: (p.program || p.course || userData.program) as string | undefined,
            branch: (p.branch || userData.branch) as string | undefined,
            year: p.year != null ? String(p.year) : userData.year,
            section: p.section ? String(p.section).toUpperCase() : userData.section,
            semester: (p.semester || userData.semester) as string | undefined,
          });
        }
      }
      toast.success('Academic details synced from GLA portal');
    } catch {
      toast.error('Portal sync failed');
    } finally {
      setPortalSyncing(false);
    }
  };

  const handleBecomeCR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData?.classId) {
      toast.error('You need an enrolled section first');
      return;
    }
    if (userData.role === 'admin') {
      toast.error('You are already a Class Rep');
      return;
    }
    const code = crInviteCode.trim();
    if (!code) {
      toast.error('Enter the CR invite code');
      return;
    }

    setCrLoading(true);
    try {
      // Verified server-side (Admin SDK): code check, usage count, expiry.
      await crApi.redeem(code);
      setUserData({ ...userData, role: 'admin' });
      setCrInviteCode('');
      toast.success('You are now a Class Rep');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not elevate to CR');
    } finally {
      setCrLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData) return;

    setLoading(true);
    try {
      let requiresContextUpdate = false;
      const newUserData = { ...userData };

      const isEmailChanged = !isPortalUser && email !== currentUser.email;
      const isPasswordChanged = !isPortalUser && newPassword.length > 0;

      if (isEmailChanged || isPasswordChanged) {
        if (!currentPassword) {
          toast.error('Authentication Required');
          setLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      const updates: Record<string, unknown> = {};
      if (!isPortalUser && name !== userData.name) {
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
      if (!isPortalUser && dob !== userData.dob) {
        updates.dob = dob;
        newUserData.dob = dob;
        requiresContextUpdate = true;
      }
      if (!isPortalUser && rollNo !== userData.rollNo) {
        updates.rollNo = rollNo;
        newUserData.rollNo = rollNo;
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Profile update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountDelete = async () => {
    if (!currentUser || !userData) {
      toast.error('Authentication Required');
      return;
    }

    if (!deleteConfirm1 || !deleteConfirm2) {
      toast.error('Please verify both safety checks');
      return;
    }

    if (isPortalUser) {
      const expected = (userData.rollNo || currentUser.uid.replace(/^gla_/, '')).toUpperCase();
      if (deleteConfirmText.trim().toUpperCase() !== expected) {
        toast.error('Type your roll number to confirm');
        return;
      }
    } else if (!currentPassword) {
      toast.error('Authentication Required');
      return;
    }

    setDeleteLoading(true);
    try {
      if (userData.isSuperAdmin) {
        const q = query(collection(db, 'users'), where('isSuperAdmin', '==', true));
        const snapshot = await getCountFromServer(q);
        if (snapshot.data().count <= 1) {
          toast.error('You are the last super admin. Add another super admin before deleting this account.');
          setDeleteLoading(false);
          return;
        }
      }

      if (!isPortalUser) {
        const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      await deleteDoc(doc(db, 'users', currentUser.uid));

      try {
        await deleteUser(currentUser);
      } catch {
        // Portal sessions may lack a recent password reauth — sign out after Firestore purge
        await signOut(auth);
      }

      toast.success('Account deleted');
      navigate('/login');
    } catch (error: unknown) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Could not delete');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!userData) return null;

  const deleteReady = deleteConfirm1 && deleteConfirm2 && (
    isPortalUser
      ? deleteConfirmText.trim().toUpperCase() === (userData.rollNo || currentUser?.uid.replace(/^gla_/, '') || '').toUpperCase()
      : !!currentPassword
  );

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          eyebrow="Account"
          title="Profile"
          description="Manage your details, notification preferences, and section membership."
          actions={
            <Card className="flex items-center gap-4 px-4 py-3">
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">Trust score</p>
                <p className="text-2xl font-semibold text-primary">{trustScore}%</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <UserCircle className="h-6 w-6" />
              </div>
            </Card>
          }
        />

        <Card elevated className="p-5 sm:p-8">
          <form onSubmit={handleUpdateProfile} className="space-y-10">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              <div className="space-y-8">
                <h3 className="flex items-center gap-2 text-xs font-semibold tracking-normal text-muted-foreground">
                  <UserCircle className="h-3 w-3" /> Your details
                </h3>
                <div className="space-y-6">
                  <Input
                    label="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    disabled={isPortalUser}
                    className={isPortalUser ? 'cursor-not-allowed bg-muted/5 opacity-70' : undefined}
                  />
                  {!isPortalUser ? (
                    <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="College email" required />
                  ) : (
                    <Input label="Auth" value={`GLA portal · ${userData.rollNo || currentUser?.uid.replace(/^gla_/, '')}`} disabled className="cursor-not-allowed bg-muted/5 opacity-70" />
                  )}
                  <Input
                    label="University Roll No"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="Enter your roll number"
                    required
                    disabled={isPortalUser}
                    className={isPortalUser ? 'cursor-not-allowed bg-muted/5 opacity-70' : undefined}
                  />
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    disabled={isPortalUser}
                    className={isPortalUser ? 'cursor-not-allowed bg-muted/5 opacity-70' : undefined}
                  />
                </div>
              </div>

              <div className="space-y-8">
                <h3 className="flex items-center justify-between gap-2 text-xs font-semibold tracking-normal text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-3 w-3" /> Academic Details
                    {isPortalUser && (
                      <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground/80">
                        from GLA portal
                      </span>
                    )}
                  </span>
                  {isPortalUser && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 px-2 text-[11px]"
                      disabled={portalSyncing}
                      onClick={() => void handleSyncFromPortal()}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${portalSyncing ? 'animate-spin' : ''}`} />
                      {portalSyncing ? 'Syncing…' : 'Sync'}
                    </Button>
                  )}
                </h3>
                <div className="space-y-6">
                  <Input label="Course" value={course || program || '—'} disabled className="cursor-not-allowed bg-muted/5 opacity-50" />
                  <Input label="Academic Year" value={year || '—'} disabled className="cursor-not-allowed bg-muted/5 opacity-50" />
                  <Input label="Semester" value={semester || '—'} disabled className="cursor-not-allowed bg-muted/5 opacity-50" />
                  <Input label="Assigned Section" value={section || '—'} disabled className="cursor-not-allowed bg-muted/5 opacity-50" />
                  <Input label="Program" value={program || '—'} disabled className="cursor-not-allowed bg-muted/5 opacity-50" />
                  <Input label="Branch" value={branch || '—'} disabled className="cursor-not-allowed bg-muted/5 opacity-50" />
                </div>
              </div>
            </div>

            {!isPortalUser && (
              <div className="space-y-8 border-t border-border pt-8">
                <h3 className="flex items-center gap-2 text-xs font-semibold tracking-normal text-muted-foreground">
                  <Lock className="h-3 w-3" /> Security
                </h3>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required for major changes" />
                  <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 chars" />
                </div>
              </div>
            )}

            <div className="space-y-8 border-t border-border pt-8">
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-normal text-muted-foreground">
                <Fingerprint className="h-3 w-3" /> Reminders
              </h3>
              <div className="space-y-4">
                <label className="ml-1 block text-xs font-medium text-muted-foreground">
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
                  <div className="flex h-10 w-20 items-center justify-center rounded-xl border border-border bg-muted font-semibold text-primary">
                    {deadlinePreference}D
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={loading} className="h-12 rounded-2xl px-8 font-medium shadow-[var(--shadow)] sm:h-14 sm:px-12">
                {loading ? 'Saving...' : 'Update Profile'}
              </Button>
            </div>
          </form>
        </Card>

        {userData.classId && userData.role !== 'admin' && !userData.isSuperAdmin && (
          <Card className="p-6 sm:p-8">
            <h2 className="mb-2 flex items-center gap-3 text-xl font-semibold tracking-tight">
              <Shield className="h-5 w-5 text-primary" /> Become Class Rep
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Enter the CR invite code for your section. This does not change your portal-mapped class — it only elevates your role.
            </p>
            <form onSubmit={handleBecomeCR} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="CR invite code"
                  value={crInviteCode}
                  onChange={(e) => setCrInviteCode(e.target.value)}
                  placeholder="CR-…"
                  required
                />
              </div>
              <Button type="submit" disabled={crLoading} className="h-12 sm:mb-0.5">
                {crLoading ? 'Checking…' : 'Elevate to CR'}
              </Button>
            </form>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <Card className="p-6 sm:p-8">
            <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold tracking-tight">
              <Bell className="h-5 w-5 text-primary" /> Notifications
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Enable notifications for real-time updates on event approvals and class announcements.
            </p>
            <div className="space-y-4 rounded-2xl border border-border bg-muted/60 p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <p className={`text-sm font-semibold ${Notification.permission === 'granted' ? 'text-success' : 'text-danger'}`}>
                    {Notification.permission === 'granted' ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${Notification.permission === 'granted' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {Notification.permission === 'granted' ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                </div>
              </div>
              <Button onClick={requestPermission} disabled={Notification.permission === 'granted'} className="w-full">
                {Notification.permission === 'granted' ? 'Notifications Active' : 'Enable Notifications'}
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col justify-between border-danger/20 p-6 sm:p-8">
            <div className="space-y-3">
              <h2 className="flex items-center gap-3 text-xl font-semibold tracking-tight text-danger">
                <ShieldAlert className="h-5 w-5" /> Account security
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Irreversible deletion of your account from the RemindrX platform.
              </p>
            </div>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="group mt-8 w-full rounded-2xl border border-danger/15 bg-danger/5 p-5 text-left transition-all hover:bg-danger/10"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-danger">Delete account</p>
                  <p className="text-xs text-muted-foreground">Permanent removal from the platform</p>
                </div>
                <ShieldAlert className="h-5 w-5 text-danger" />
              </div>
            </button>
          </Card>
        </div>
      </div>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete account">
        <div className="space-y-8 p-2">
          <div className="flex items-start gap-4 rounded-2xl border border-danger/20 bg-danger/10 p-6">
            <ShieldAlert className="mt-1 h-6 w-6 shrink-0 text-danger" />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold leading-none text-danger">Irreversible Action</h4>
              <p className="text-xs font-medium leading-relaxed tracking-normal text-danger/80">
                This will permanently delete your profile from RemindrX.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-muted p-4 hover:bg-muted">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-danger" checked={deleteConfirm1} onChange={(e) => setDeleteConfirm1(e.target.checked)} />
              <span className="text-xs font-semibold tracking-normal opacity-60">I understand that all my data will be permanently erased.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-muted p-4 hover:bg-muted">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-danger" checked={deleteConfirm2} onChange={(e) => setDeleteConfirm2(e.target.checked)} />
              <span className="text-xs font-semibold tracking-normal opacity-60">I confirm that this action cannot be undone.</span>
            </label>
          </div>

          <div className="space-y-4">
            <p className="text-center text-xs font-semibold text-muted-foreground">Verification Required</p>
            {isPortalUser ? (
              <Input
                label="Type your roll number"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={userData.rollNo || 'Roll number'}
                required
              />
            ) : (
              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter password to proceed"
                required
              />
            )}
          </div>

          <div className="flex gap-4">
            <Button variant="ghost" className="h-14 flex-1 rounded-2xl" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="h-14 flex-1 rounded-2xl bg-danger font-medium text-white shadow-xl shadow-danger/20 hover:bg-danger/90"
              disabled={!deleteReady || deleteLoading}
              onClick={handleAccountDelete}
            >
              {deleteLoading ? 'Deleting...' : 'Confirm Deletion'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
