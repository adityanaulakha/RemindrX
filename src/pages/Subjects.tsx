import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Book, Edit2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Subjects() {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<'theory' | 'lab'>('theory');

  useEffect(() => {
    fetchSubjects();
  }, [userData]);

  const fetchSubjects = async () => {
    if (!userData?.classId) return;
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
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.classId || !currentUser) return;

    try {
      const newSubject: Omit<Subject, 'id'> = {
        name,
        code,
        type,
        classId: userData.classId,
        isActive: true,
        createdBy: currentUser.uid,
      };

      await addDoc(collection(db, 'subjects'), newSubject);
      toast.success('Subject added successfully!');
      
      // Reset form
      setName('');
      setCode('');
      setType('theory');
      setShowAddForm(false);
      
      fetchSubjects();
    } catch (error) {
      toast.error('Failed to add subject');
      console.error(error);
    }
  };

  const handleDisableSubject = async (e: React.MouseEvent, subjectId: string) => {
    e.stopPropagation(); // Prevent card click
    if (!window.confirm('Are you sure you want to disable this subject? It will no longer accept new tasks.')) return;
    try {
      await updateDoc(doc(db, 'subjects', subjectId), {
        isActive: false
      });
      toast.success('Subject disabled');
      fetchSubjects();
    } catch (error) {
      toast.error('Failed to disable subject');
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-12 bg-card rounded-xl"></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="h-40 bg-card rounded-xl"></div>
        <div className="h-40 bg-card rounded-xl"></div>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects & Labs</h1>
          <p className="text-foreground/60">Manage all your academic courses.</p>
        </div>
        
        {userData?.role === 'admin' && (
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : <><Plus className="mr-2 h-4 w-4" /> Add Subject</>}
          </Button>
        )}
      </div>

      {showAddForm && userData?.role === 'admin' && (
        <Card className="border-primary/50 bg-primary/5 shadow-md">
          <CardHeader>
            <CardTitle>Add New Subject/Lab</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSubject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Subject Name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Data Structures" 
                  required 
                />
                <Input 
                  label="Subject Code" 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)} 
                  placeholder="e.g. CS201" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground/80">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={type === 'theory'} 
                      onChange={() => setType('theory')} 
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Theory</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={type === 'lab'} 
                      onChange={() => setType('lab')} 
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Lab</span>
                  </label>
                </div>
              </div>
              <Button type="submit">Save Subject</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
          <Book className="mb-4 h-12 w-12 text-foreground/20" />
          <h3 className="text-lg font-semibold">No subjects found</h3>
          <p className="text-foreground/60 max-w-sm mt-1">
            {userData?.role === 'admin' 
              ? "You haven't added any subjects yet. Click the Add Subject button to get started."
              : "Your Class Rep hasn't added any subjects yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <Card 
              key={subject.id} 
              className="hover:shadow-md transition-shadow group cursor-pointer hover:border-primary/50"
              onClick={() => navigate(`/subjects/${subject.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg truncate pr-2">{subject.name}</CardTitle>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    subject.type === 'theory' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                  }`}>
                    {subject.type}
                  </span>
                </div>
                <p className="text-sm font-mono text-foreground/60">{subject.code}</p>
              </CardHeader>
              {userData?.role === 'admin' && (
                <CardContent className="pt-0 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-danger hover:text-danger hover:bg-danger/10"
                    onClick={(e) => handleDisableSubject(e, subject.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
