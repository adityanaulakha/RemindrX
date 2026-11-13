import { useCallback, useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDoc, doc, addDoc, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { ClassData, ClassSecrets } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ShieldAlert, Users, ShieldCheck, Search, ChevronLeft, ChevronRight, GraduationCap, LayoutGrid, Info, Copy, Bell, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { crApi, type RosterStudent } from '../services/api';

const ITEMS_PER_PAGE = 8;

export default function CRPanel() {
  const { userData, currentUser } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [secrets, setSecrets] = useState<ClassSecrets | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [trustScores, setTrustScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  // Search and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [health, setHealth] = useState({ subjects: 0, openTasks: 0, avgTrust: 0 });

  const fetchAdminData = useCallback(async () => {
    if (!userData?.classId || userData.role !== 'admin') return;
    const classId = userData.classId;

    try {
      // One roster call: minimal fields + trust scores computed server-side
      // from a single posts query (no per-student reads).
      const [classSnap, secretSnap, rosterRes, subCount, openTaskCount] = await Promise.all([
        getDoc(doc(db, 'classes', classId)),
        getDoc(doc(db, 'classSecrets', classId)).catch(() => null),
        crApi.roster(),
        getCountFromServer(
          query(collection(db, 'subjects'), where('classId', '==', classId), where('isActive', '==', true))
        ),
        getCountFromServer(
          query(collection(db, 'tasks'), where('classId', '==', classId), where('deadline', '>', Date.now()))
        ),
      ]);
      if (classSnap.exists()) setClassData({ id: classSnap.id, ...classSnap.data() } as ClassData);
      setSecrets(secretSnap && secretSnap.exists() ? (secretSnap.data() as ClassSecrets) : null);

      const fetchedStudents = rosterRes.students;
      setStudents(fetchedStudents);
      const scores: Record<string, number> = {};
      for (const st of fetchedStudents) scores[st.id] = st.trustScore;
      setTrustScores(scores);

      const values = Object.values(scores);
      const avgTrust = values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      setHealth({
        subjects: subCount.data().count,
        openTasks: openTaskCount.data().count,
        avgTrust,
      });
    } catch (error) {
      console.error('Error fetching CR panel data:', error);
      toast.error(error instanceof Error ? error.message : 'Could not load section data');
    } finally {
      setLoading(false);
    }
  }, [userData?.classId, userData?.role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleNotifySection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.classId || !currentUser) return;
    const title = notifyTitle.trim();
    const message = notifyMessage.trim();
    if (!title || !message) {
      toast.error('Title and message are required');
      return;
    }
    setNotifyLoading(true);
    try {
      const batch = students.map((student) =>
        addDoc(collection(db, 'notifications'), {
          userId: student.id,
          title,
          message,
          type: 'section_broadcast',
          classId: userData.classId,
          createdBy: currentUser.uid,
          createdAt: Date.now(),
          read: false,
        })
      );
      await Promise.all(batch);
      toast.success(`Notified ${students.length} classmates`);
      setNotifyTitle('');
      setNotifyMessage('');
    } catch {
      toast.error('Could not send section notice');
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleDemoteAdmin = async (userId: string) => {
    if (userId === currentUser?.uid) {
      toast.error("You cannot demote yourself.");
      return;
    }
    if (!classData || !window.confirm("Are you sure you want to demote this CR to a student?")) return;

    try {
      await crApi.demote(userId);
      toast.success('CR status revoked');
      fetchAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  // Search and Filter Logic
  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.rollNo && s.rollNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);

  const crs = students.filter(s => s.role === 'admin');

  if (loading || !classData) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Class representative"
        title="CR Panel"
        description="Management console for Class Representatives. Control class identity and verify members."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Class Metadata */}
        <div className="space-y-8">
          <Card className="rounded-3xl border border-border bg-card/40 overflow-hidden group">
            <CardHeader className="p-8 border-b border-border">
              <CardTitle className="text-xl font-semibold tracking-tight flex items-center gap-3">
                <LayoutGrid className="h-5 w-5 text-primary" /> Section
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted border border-border">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-primary opacity-50" />
                    <span className="text-xs font-medium opacity-40">Class Year</span>
                  </div>
                  <span className="text-sm font-semibold">{classData.year || 'N/A'}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted border border-border">
                  <div className="flex items-center gap-3">
                    <Info className="h-5 w-5 text-accent opacity-50" />
                    <span className="text-xs font-medium opacity-40">Section</span>
                  </div>
                  <span className="text-sm font-semibold">{classData.section || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted border border-border">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-success opacity-50" />
                    <span className="text-xs font-medium opacity-40">Strength</span>
                  </div>
                  <span className="text-sm font-semibold">{students.length} Members</span>
                </div>
              </div>

              <div className="pt-8 border-t border-border space-y-4">
                <p className="text-xs font-medium opacity-40 mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Section health
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                    <p className="text-lg font-semibold">{health.subjects}</p>
                    <p className="text-[10px] text-muted-foreground">Subjects</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                    <p className="text-lg font-semibold">{health.openTasks}</p>
                    <p className="text-[10px] text-muted-foreground">Open tasks</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                    <p className="text-lg font-semibold">{health.avgTrust}</p>
                    <p className="text-[10px] text-muted-foreground">Avg trust</p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-border">
                <p className="text-xs font-medium opacity-40 mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Active CRs
                </p>
                <div className="flex flex-wrap gap-2">
                  {crs.map(cr => (
                    <div key={cr.id} className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                      {cr.name}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-card/40 p-8">
            <form onSubmit={handleNotifySection} className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notify section
              </p>
              <Input
                label="Title"
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
                placeholder="e.g. Tomorrow’s lab cancelled"
                required
              />
              <Input
                label="Message"
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="Short notice for your section"
                required
              />
              <Button type="submit" className="w-full" disabled={notifyLoading || students.length === 0}>
                {notifyLoading ? 'Sending…' : `Notify ${students.length} members`}
              </Button>
            </form>
          </Card>

          <Card className="rounded-3xl border border-border bg-card/40 p-8">
             <div className="space-y-6">
               <p className="text-sm font-medium text-muted-foreground">CR invite</p>
               <div className="p-6 rounded-2xl bg-danger/5 border border-danger/10 relative overflow-hidden group">
                 <button
                    className="absolute top-4 right-4 p-2 rounded-xl bg-danger/10 text-danger opacity-0 group-hover:opacity-100 transition-all hover:bg-danger hover:text-white z-20"
                    onClick={() => {
                      navigator.clipboard.writeText(secrets?.adminInviteCode || '');
                      toast.success('ID Copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <ShieldAlert className="h-12 w-12" />
                 </div>
                 <p className="text-xs font-medium text-danger opacity-60 mb-2">CR Invite Code</p>
                 <div className="flex items-center justify-between">
                   <code className="text-2xl font-semibold text-danger">{secrets?.adminInviteCode || '—'}</code>
                   <span className="text-xs font-bold text-danger/40">{secrets?.adminCodeUses ?? 0} left</span>
                 </div>
                 <p className="mt-3 text-xs text-muted-foreground">Students enroll via GLA portal — this code only elevates a classmate to Class Rep.</p>
               </div>
             </div>
          </Card>
        </div>

        {/* Members Management */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-card/40 border border-border p-6 rounded-2xl">
             <div className="relative w-full md:w-96 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-30 group-focus-within:opacity-100 transition-opacity" />
                <input 
                  type="text" 
                  placeholder="Search students by name, roll no or email..."
                  className="w-full h-14 pl-16 pr-6 bg-muted border border-border rounded-2xl text-xs font-bold tracking-normal outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
             </div>
             <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-muted-foreground">Page {currentPage} of {totalPages || 1}</span>
                <div className="flex gap-2">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-12 w-12 rounded-xl bg-muted border border-border disabled:opacity-20"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                   >
                     <ChevronLeft className="h-5 w-5" />
                   </Button>
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-12 w-12 rounded-xl bg-muted border border-border disabled:opacity-20"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                   >
                     <ChevronRight className="h-5 w-5" />
                   </Button>
                </div>
             </div>
          </div>

          <div className="space-y-4">
            {paginatedStudents.length === 0 ? (
              <div className="p-20 text-center bg-card/20 rounded-3xl border border-dashed border-border">
                <Users className="h-16 w-16 mx-auto mb-6 opacity-10" />
                <p className="text-xs font-semibold text-muted-foreground">No matches found in database</p>
              </div>
            ) : (
              paginatedStudents.map(student => (
                <div key={student.id} className="group relative flex flex-col sm:flex-row items-center justify-between p-6 bg-card/40 border border-border rounded-2xl transition-all hover:bg-muted hover:border-primary/20">
                  <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                    <div className="h-14 w-14 rounded-2xl bg-primary-soft flex items-center justify-center font-semibold text-xl shadow-inner">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold tracking-tight flex items-center gap-2">
                        {student.name}
                        {student.role === 'admin' && <ShieldCheck className="h-4 w-4 text-primary" />}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="text-xs font-bold text-primary tracking-widest">{student.rollNo || 'No Roll No.'}</span>
                        <span className="text-xs font-medium text-muted-foreground tracking-widest">{student.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 mt-6 sm:mt-0">
                    <div className="text-right">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Trust</p>
                      <p className="text-lg font-semibold text-primary leading-none">{trustScores[student.id] ?? 0}</p>
                    </div>
                    {student.role === 'admin' && student.id !== currentUser?.uid && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-12 px-6 rounded-xl bg-danger/10 text-danger border border-danger/10 hover:bg-danger/20 font-medium text-xs"
                        onClick={() => handleDemoteAdmin(student.id)}
                      >
                        Revoke CR
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
