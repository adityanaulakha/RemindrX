import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BookOpen, Edit2, Plus, Trash2, GraduationCap, Layers, Zap, Search, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Subjects() {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<'theory' | 'lab'>('theory');
  const [credits, setCredits] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubjects();
  }, [userData]);

  const fetchSubjects = async (force = false) => {
    if (!userData?.classId) return;
    setLoading(true);

    try {
      const q = query(
        collection(db, 'subjects'),
        where('classId', '==', userData.classId),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const fetchedSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      toast.error('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.classId || !currentUser) return;

    try {
      const subjectData: Omit<Subject, 'id'> = {
        name,
        code: code.trim().toUpperCase(),
        type,
        credits: parseFloat(credits) || 0,
        classId: userData.classId,
        isActive: true,
        createdBy: currentUser.uid,
      };

      if (editingId) {
        await updateDoc(doc(db, 'subjects', editingId), {
          name,
          code: code.trim().toUpperCase(),
          type,
          credits: parseFloat(credits) || 0
        });
      } else {
        await addDoc(collection(db, 'subjects'), subjectData);
      }
      
      toast.success(editingId ? 'Subject updated' : 'Subject added');
      setName(''); setCode(''); setType('theory'); setCredits('0');
      setEditingId(null); setShowAddForm(false);
      fetchSubjects();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-12">
        <div className="h-64 bg-card/20 rounded-[3.5rem] border border-white/5"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-card/20 rounded-[2.5rem] border border-white/5"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="relative overflow-hidden rounded-[3.5rem] bg-card/60 backdrop-blur-xl border border-white/10 p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <BookOpen className="h-64 w-64 text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
              Subjects
            </h1>
            <p className="text-sm font-medium text-foreground/40 max-w-xl">
              Academic management for {subjects.length} active units
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 group-focus-within:opacity-100 transition-opacity" />
              <input 
                type="text" 
                placeholder="Find Unit..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-14 w-64 rounded-2xl bg-white/5 border border-white/10 pl-14 pr-6 text-xs font-bold uppercase tracking-widest italic outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            {userData?.role === 'admin' && (
              <Button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest italic shadow-2xl shadow-primary/20"
              >
                {showAddForm ? 'Close Sync' : <><Plus className="mr-2 h-5 w-5" /> Initialize Unit</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {showAddForm && userData?.role === 'admin' && (
        <div className="animate-in zoom-in-95 fade-in duration-500">
          <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-[3.5rem] p-10 lg:p-12 shadow-2xl relative overflow-hidden">
             <div className="absolute -top-24 -right-24 h-64 w-64 bg-primary/10 rounded-full blur-[100px]" />
             <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-10 text-primary">Unit Configuration</h2>
             <form onSubmit={handleAddSubject} className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                 <div className="md:col-span-2">
                   <Input label="Unit Identity (Name)" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quantum Computing" required />
                 </div>
                 <Input label="Matrix ID (Code)" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. QC101" required />
                 <Input label="Credit Weight" type="number" step="0.5" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="4.0" required />
               </div>
               
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-4">
                 <div className="flex gap-4 p-2 bg-white/5 rounded-2xl border border-white/5">
                   {['theory', 'lab'].map((t) => (
                     <button
                       key={t}
                       type="button"
                       onClick={() => setType(t as any)}
                       className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === t ? 'bg-primary text-primary-foreground shadow-lg' : 'text-foreground/30 hover:text-foreground'}`}
                     >
                       {t}
                     </button>
                   ))}
                 </div>
                 <Button type="submit" className="h-14 px-12 rounded-2xl font-black uppercase tracking-widest italic">
                   {editingId ? 'Push Update' : 'Initialize Unit'}
                 </Button>
               </div>
             </form>
          </div>
        </div>
      )}

      {filteredSubjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[3.5rem] bg-card/20 border border-dashed border-white/10 p-24 text-center">
          <Activity className="mb-8 h-20 w-20 text-foreground/5 opacity-20 animate-pulse" />
          <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Matrix Depleted</h3>
          <p className="text-sm text-foreground/30 font-medium max-w-sm uppercase tracking-widest">
            {userData?.role === 'admin' 
              ? "No active units found. Initialize the matrix to begin tracking."
              : "Synchronizing with your representative..."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects.map((subject) => (
            <div 
              key={subject.id} 
              className="group relative bg-card/40 backdrop-blur-xl border border-white/5 rounded-[3rem] p-8 transition-all duration-500 hover:scale-[1.02] hover:border-primary/30 hover:shadow-2xl cursor-pointer overflow-hidden"
              onClick={() => navigate(`/subjects/${subject.id}`)}
            >
              {/* Card Glow */}
              <div className={`absolute -top-24 -right-24 h-48 w-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${subject.type === 'theory' ? 'bg-primary' : 'bg-accent'}`} />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-8">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 shadow-inner ${
                    subject.type === 'theory' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                  }`}>
                    {subject.type === 'theory' ? <GraduationCap className="h-7 w-7" /> : <Zap className="h-7 w-7" />}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">Matrix Code</span>
                    <span className="font-mono text-sm font-black italic opacity-60 tracking-tighter">{subject.code.toUpperCase()}</span>
                  </div>
                </div>

                <h3 className="text-2xl font-black tracking-tighter italic uppercase mb-2 leading-tight group-hover:text-primary transition-colors">{subject.name}</h3>
                
                <div className="mt-auto pt-8 flex items-center justify-between border-t border-white/5">
                   <div className="flex items-center gap-2">
                     <Layers className="h-4 w-4 opacity-20" />
                     <span className="text-xs font-bold opacity-40 uppercase tracking-widest">{subject.credits || 0} Credits</span>
                   </div>
                   
                   {userData?.role === 'admin' && (
                     <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 translate-y-0 lg:translate-y-4 lg:group-hover:translate-y-0">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="h-10 w-10 p-0 rounded-xl hover:bg-primary/20 hover:text-primary border border-white/5" 
                         onClick={(e) => { 
                           e.stopPropagation(); 
                           setEditingId(subject.id);
                           setName(subject.name); setCode(subject.code); setType(subject.type);
                           setCredits((subject.credits || 0).toString());
                           setShowAddForm(true);
                           window.scrollTo({ top: 0, behavior: 'smooth' });
                         }}
                       >
                         <Edit2 className="h-4 w-4" />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="h-10 w-10 p-0 rounded-xl hover:bg-rose-500/20 hover:text-rose-500 border border-white/5"
                         onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Deactivate this core unit?')) {
                              updateDoc(doc(db, 'subjects', subject.id), { isActive: false }).then(() => fetchSubjects());
                            }
                         }}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
