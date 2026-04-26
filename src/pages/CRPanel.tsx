import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { User, ClassData } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ShieldAlert, Users, UserMinus, ShieldCheck, Search, ChevronLeft, ChevronRight, GraduationCap, Hash, LayoutGrid, Info, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calculateTrustScore } from '../utils/trustScore';

const ITEMS_PER_PAGE = 8;

export default function CRPanel() {
  const { userData, currentUser } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [trustScores, setTrustScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  // Search and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchAdminData();
  }, [userData]);

  const fetchAdminData = async () => {
    if (!userData?.classId || userData.role !== 'admin') return;

    try {
      // Fetch Class Data
      const classSnap = await getDocs(query(collection(db, 'classes'), where('__name__', '==', userData.classId)));
      if (!classSnap.empty) {
        setClassData({ id: classSnap.docs[0].id, ...classSnap.docs[0].data() } as ClassData);
      }

      // Fetch Students
      const q = query(collection(db, 'users'), where('classId', '==', userData.classId));
      const studentSnap = await getDocs(q);
      const fetchedStudents = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setStudents(fetchedStudents);
      
      // Compute trust scores
      const scores: Record<string, number> = {};
      await Promise.all(fetchedStudents.map(async (student) => {
        scores[student.id] = await calculateTrustScore(student.id);
      }));
      setTrustScores(scores);
    } catch (error) {
      console.error("Error fetching CR panel data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoteAdmin = async (userId: string) => {
    if (userId === currentUser?.uid) {
      toast.error("You cannot demote yourself.");
      return;
    }
    if (!classData || !window.confirm("Are you sure you want to demote this CR to a student?")) return;

    try {
      await updateDoc(doc(db, 'classes', classData.id), {
        admins: arrayRemove(userId)
      });
      
      await updateDoc(doc(db, 'users', userId), {
        role: 'student'
      });

      toast.success("CR status revoked");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to update status");
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

  if (loading || !classData) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-48 bg-card/20 rounded-[3.5rem] border border-white/5"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 h-64 bg-card/20 rounded-[3rem]"></div>
          <div className="lg:col-span-2 h-96 bg-card/20 rounded-[3rem]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[3.5rem] bg-card/60 backdrop-blur-xl border border-white/10 p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <ShieldAlert className="h-64 w-64 text-primary" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
            CR Panel
          </h1>
          <p className="text-sm font-medium text-foreground/40 max-w-xl">
            Management console for Class Representatives. Control class identity and verify members.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Class Metadata */}
        <div className="space-y-8">
          <Card className="rounded-[3rem] border border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden group">
            <CardHeader className="p-8 border-b border-white/5">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                <LayoutGrid className="h-5 w-5 text-primary" /> Matrix Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-primary opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Class Year</span>
                  </div>
                  <span className="text-sm font-black italic">{classData.year || 'N/A'}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Info className="h-5 w-5 text-accent opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Section</span>
                  </div>
                  <span className="text-sm font-black italic">{classData.section || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-emerald-500 opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Strength</span>
                  </div>
                  <span className="text-sm font-black italic">{students.length} Members</span>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Active CRs
                </p>
                <div className="flex flex-wrap gap-2">
                  {crs.map(cr => (
                    <div key={cr.id} className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary italic">
                      {cr.name}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[3rem] border border-white/5 bg-card/40 backdrop-blur-xl p-8">
             <div className="space-y-6">
               <p className="text-sm font-black italic uppercase tracking-widest opacity-30">Access Protocols</p>
               <div className="space-y-4">
                 <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 relative overflow-hidden group">
                   <button 
                      className="absolute top-4 right-4 p-2 rounded-xl bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white z-20"
                      onClick={() => {
                        navigator.clipboard.writeText(classData.joinCode);
                        toast.success('Key Copied');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                   <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Hash className="h-12 w-12" />
                   </div>
                   <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-2">Student Join Code</p>
                   <code className="text-2xl font-black italic text-primary">{classData.joinCode}</code>
                 </div>
                 
                 <div className="p-6 rounded-[2rem] bg-danger/5 border border-danger/10 relative overflow-hidden group">
                   <button 
                      className="absolute top-4 right-4 p-2 rounded-xl bg-danger/10 text-danger opacity-0 group-hover:opacity-100 transition-all hover:bg-danger hover:text-white z-20"
                      onClick={() => {
                        navigator.clipboard.writeText(classData.adminInviteCode);
                        toast.success('ID Copied');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                   <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <ShieldAlert className="h-12 w-12" />
                   </div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-danger opacity-60 mb-2">CR Invite Code</p>
                   <div className="flex items-center justify-between">
                     <code className="text-2xl font-black italic text-danger">{classData.adminInviteCode}</code>
                     <span className="text-[10px] font-bold text-danger/40">{classData.adminCodeUses} left</span>
                   </div>
                 </div>
               </div>
             </div>
          </Card>
        </div>

        {/* Members Management */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-card/40 backdrop-blur-xl border border-white/5 p-6 rounded-[2.5rem]">
             <div className="relative w-full md:w-96 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-30 group-focus-within:opacity-100 transition-opacity" />
                <input 
                  type="text" 
                  placeholder="Search students by name, roll no or email..."
                  className="w-full h-14 pl-16 pr-6 bg-white/5 border border-white/5 rounded-2xl text-xs font-bold uppercase tracking-widest italic outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
             </div>
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Page {currentPage} of {totalPages || 1}</span>
                <div className="flex gap-2">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-12 w-12 rounded-xl bg-white/5 border border-white/5 disabled:opacity-20"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                   >
                     <ChevronLeft className="h-5 w-5" />
                   </Button>
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-12 w-12 rounded-xl bg-white/5 border border-white/5 disabled:opacity-20"
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
              <div className="p-20 text-center bg-card/20 rounded-[3rem] border border-dashed border-white/10">
                <Users className="h-16 w-16 mx-auto mb-6 opacity-10" />
                <p className="text-xs font-black uppercase tracking-[0.3em] opacity-30 italic">No matches found in database</p>
              </div>
            ) : (
              paginatedStudents.map(student => (
                <div key={student.id} className="group relative flex flex-col sm:flex-row items-center justify-between p-6 bg-card/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] transition-all hover:bg-white/5 hover:border-primary/20">
                  <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-black text-xl italic shadow-inner">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black italic uppercase tracking-tighter flex items-center gap-2">
                        {student.name}
                        {student.role === 'admin' && <ShieldCheck className="h-4 w-4 text-primary" />}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="text-[10px] font-bold text-primary tracking-widest uppercase italic">{student.rollNo || 'No Roll No.'}</span>
                        <span className="text-[10px] font-medium text-foreground/30 tracking-widest uppercase italic">{student.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 mt-6 sm:mt-0">
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-1">Trust Matrix</p>
                      <p className="text-lg font-black italic text-primary leading-none">{trustScores[student.id] ?? 0}</p>
                    </div>
                    {student.role === 'admin' && student.id !== currentUser?.uid && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-12 px-6 rounded-xl bg-danger/10 text-danger border border-danger/10 hover:bg-danger/20 font-black uppercase tracking-widest italic text-[10px]"
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
