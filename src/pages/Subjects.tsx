import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { BookOpen, Edit2, Plus, Trash2, GraduationCap, Layers, Zap, Search } from 'lucide-react';
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

  if (loading) return <PageSkeleton rows={6} />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Section curriculum"
        title="Subjects"
        description={`Subjects in your section — ${subjects.length} active units`}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search subjects"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="control h-11 w-52 pl-9 sm:w-64"
              />
            </div>
            {userData?.role === 'admin' && (
              <Button onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? 'Close' : <><Plus className="h-4 w-4" /> Add subject</>}
              </Button>
            )}
          </>
        }
      />

      {showAddForm && userData?.role === 'admin' && (
        <Card elevated className="p-6 sm:p-8">
          <h2 className="mb-6 text-lg font-semibold tracking-tight text-primary">Subject</h2>
          <form onSubmit={handleAddSubject} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <Input label="Subject name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Subject name" required />
              </div>
              <Input label="Subject code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Subject code" required />
              <Input label="Credits" type="number" step="0.5" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="4.0" required />
            </div>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex gap-2 rounded-xl border border-border bg-muted/60 p-1">
                {(['theory', 'lab'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold capitalize transition-all ${type === t ? 'bg-primary text-primary-foreground shadow-[var(--shadow)]' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Button type="submit">{editingId ? 'Save changes' : 'Add subject'}</Button>
            </div>
          </form>
        </Card>
      )}

      {filteredSubjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description={userData?.authProvider === 'gla_portal'
            ? 'Subjects sync from your GLA portal allotment. Class reps can still add extras.'
            : userData?.role === 'admin'
            ? 'Add the first subject for your section.'
            : 'Your class representative has not added subjects yet.'}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects.map((subject) => (
            <Card
              key={subject.id}
              interactive
              className="group cursor-pointer p-5"
              onClick={() => navigate(`/subjects/${subject.id}`)}
            >
              <div className="mb-5 flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  subject.type === 'theory' ? 'bg-primary-soft text-primary' : 'bg-accent/15 text-accent'
                }`}>
                  {subject.type === 'theory' ? <GraduationCap className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                </div>
                <Badge tone="neutral">{subject.code.toUpperCase()}</Badge>
              </div>
              <h3 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary">{subject.name}</h3>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  {subject.credits || 0} credits
                </div>
                {userData?.role === 'admin' && (
                  <div className="flex gap-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
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
                      className="h-9 w-9 p-0 text-danger hover:bg-danger/10"
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
