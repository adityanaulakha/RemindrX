import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject, Post, Task } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MessageSquare, ThumbsUp, ThumbsDown, ShieldCheck, ArrowLeft, CheckSquare, FileText, Calendar, Clock, AlertTriangle, Zap, Activity, Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SubjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData, currentUser } = useAuth();
  
  const [subject, setSubject] = useState<Subject | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'resources' | 'updates'>('tasks');
  const [visiblePosts, setVisiblePosts] = useState(10);

  useEffect(() => {
    if (!id || !userData?.classId) return;

    const fetchSubject = async () => {
      try {
        const q = query(collection(db, 'subjects'), where('__name__', '==', id));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setSubject({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Subject);
        } else {
          toast.error("Cluster not found");
          navigate('/subjects');
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchSubject();

    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const postsQuery = query(
      collection(db, 'posts'), 
      where('subjectId', '==', id),
      where('createdAt', '>=', oneMonthAgo)
    );
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      fetchedPosts.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(fetchedPosts);
    });

    const tasksQuery = query(collection(db, 'tasks'), where('subjectId', '==', id));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      fetchedTasks.sort((a, b) => a.deadline - b.deadline);
      setTasks(fetchedTasks);
      setLoading(false);
    });

    return () => {
      unsubscribePosts();
      unsubscribeTasks();
    };
  }, [id, userData, navigate]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !currentUser || !id) return;

    try {
      const newPost: Omit<Post, 'id'> = {
        content: newPostContent.trim(),
        subjectId: id,
        confirmations: [currentUser.uid],
        disputes: [],
        status: 'unverified',
        createdAt: Date.now(),
        createdBy: currentUser.uid,
      };

      await addDoc(collection(db, 'posts'), newPost);
      setNewPostContent('');
      toast.success('Intelligence Broadcasted');
    } catch (error) {
      toast.error('Broadcast failed');
    }
  };

  const handleInteract = async (post: Post, type: 'confirm' | 'dispute') => {
    if (!currentUser || !userData) return;
    
    const isConfirm = type === 'confirm';
    const hasConfirmed = post.confirmations.includes(currentUser.uid);
    const hasDisputed = post.disputes.includes(currentUser.uid);

    if (isConfirm && hasConfirmed) return;
    if (!isConfirm && hasDisputed) return;

    try {
      const postRef = doc(db, 'posts', post.id);
      let newConfirmations = [...post.confirmations];
      let newDisputes = [...post.disputes];

      if (isConfirm) {
        newConfirmations.push(currentUser.uid);
        newDisputes = newDisputes.filter(uid => uid !== currentUser.uid);
      } else {
        newDisputes.push(currentUser.uid);
        newConfirmations = newConfirmations.filter(uid => uid !== currentUser.uid);
      }

      let newStatus = post.status;
      if (newConfirmations.length >= 10 || userData.role === 'admin') {
        newStatus = 'verified';
      } else if (newConfirmations.length >= 5) {
        newStatus = 'likely';
      } else if (newDisputes.length > newConfirmations.length) {
        newStatus = 'unverified';
      }

      await updateDoc(postRef, {
        confirmations: newConfirmations,
        disputes: newDisputes,
        status: newStatus
      });

    } catch (error) {
      toast.error('Sync failed');
    }
  };

  const now = Date.now();
  const isPast = (deadline: number) => deadline < now;
  const isCritical = (deadline: number, priority: string) => !isPast(deadline) && (deadline <= now + 48 * 60 * 60 * 1000 || priority === 'critical');

  if (loading || !subject) {
    return (
      <div className="animate-pulse space-y-12">
        <div className="h-64 bg-card/20 rounded-[3.5rem] border border-white/5"></div>
        <div className="h-48 bg-card/20 rounded-[2.5rem] border border-white/5"></div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/subjects')} className="h-12 w-12 p-0 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-px flex-1 bg-white/5" />
      </div>

      <div className="relative overflow-hidden rounded-[3.5rem] bg-card/40 backdrop-blur-xl border border-white/10 p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          {subject.type === 'theory' ? <Layers className="h-64 w-64 text-primary" /> : <Zap className="h-64 w-64 text-accent" />}
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className={`h-1 w-12 rounded-full ${subject.type === 'theory' ? 'bg-primary' : 'bg-accent'}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.4em] italic ${subject.type === 'theory' ? 'text-primary' : 'text-accent'}`}>
              {subject.code.toUpperCase()} • {subject.type}
            </span>
          </div>
          <h1 className="text-6xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none">
            {subject.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest italic opacity-60">
              {subject.credits || 0} Credits
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest italic opacity-60">
              {tasks.length} Active Tasks
            </div>
          </div>
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="flex gap-4 p-2 bg-white/5 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar max-w-full">
        {[
          { id: 'tasks', icon: CheckSquare, label: 'Objectives' },
          { id: 'resources', icon: FileText, label: 'Archives' },
          { id: 'updates', icon: MessageSquare, label: 'Pulse' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-8 py-4 pr-10 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest italic transition-all shrink-0 ${
              activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/20' : 'text-foreground/40 hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-5xl">
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[3rem] bg-card/20 border border-dashed border-white/10 p-24 text-center">
                <Activity className="mb-8 h-20 w-20 text-foreground/5 opacity-20" />
                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Objectives Clear</h3>
                <p className="text-sm text-foreground/30 font-medium uppercase tracking-widest">No pending tasks detected for this cluster.</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className={`group relative rounded-[2.5rem] border p-8 transition-all duration-500 hover:scale-[1.01] ${
                  isCritical(task.deadline, task.priority) && !isPast(task.deadline)
                    ? 'bg-rose-500/5 border-rose-500/20 shadow-rose-500/5' 
                    : 'bg-card/40 border-white/5 backdrop-blur-xl'
                } ${isPast(task.deadline) ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest italic ${
                          task.priority === 'critical' ? 'bg-rose-500 text-white' :
                          task.priority === 'medium' ? 'bg-amber-500 text-white' :
                          'bg-white/10 text-foreground/60'
                        }`}>
                          {task.priority}
                        </div>
                        {isCritical(task.deadline, task.priority) && !isPast(task.deadline) && (
                          <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                            <AlertTriangle className="h-3 w-3" /> Critical Window
                          </div>
                        )}
                      </div>
                      <h3 className="text-2xl font-black italic tracking-tighter uppercase group-hover:text-primary transition-colors">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm font-medium text-foreground/50 leading-relaxed max-w-2xl">{task.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/5 shrink-0">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Deadline</p>
                        <div className="flex items-center gap-2 font-black italic text-sm">
                          <Calendar className="h-4 w-4 text-primary" />
                          {new Date(task.deadline).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="h-8 w-px bg-white/10" />
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Matrix Time</p>
                        <div className="flex items-center gap-2 font-black italic text-sm">
                          <Clock className="h-4 w-4 text-accent" />
                          {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="flex flex-col items-center justify-center rounded-[3rem] bg-card/20 border border-dashed border-white/10 p-24 text-center opacity-50">
            <FileText className="mb-8 h-20 w-20 opacity-20" />
            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Archive Encryption</h3>
            <p className="text-sm text-foreground/30 font-medium uppercase tracking-widest">Resource sharing protocol coming soon.</p>
          </div>
        )}

        {activeTab === 'updates' && (
          <div className="space-y-8">
            <form onSubmit={handleCreatePost} className="relative group">
              <input
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Broadcast intelligence to this cluster..."
                className="w-full h-20 pl-8 pr-32 rounded-[2rem] bg-card/40 backdrop-blur-xl border border-white/10 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <Button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 h-14 px-8 rounded-2xl font-black uppercase tracking-widest italic">
                Post
              </Button>
            </form>

            <div className="space-y-6">
              {posts.length === 0 ? (
                <div className="text-center py-12 opacity-30 italic font-black uppercase tracking-widest text-xs">No intelligence detected.</div>
              ) : (
                posts.slice(0, visiblePosts).map(post => (
                  <div key={post.id} className="rounded-[2.5rem] bg-card/40 backdrop-blur-xl border border-white/5 p-8 space-y-6">
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-lg font-medium text-foreground/80 leading-relaxed">{post.content}</p>
                      <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2 shrink-0 ${
                        post.status === 'verified' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        post.status === 'likely' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'bg-white/5 text-foreground/40 border border-white/10'
                      }`}>
                        {post.status === 'verified' && <ShieldCheck className="h-3 w-3" />}
                        {post.status}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                      <div className="flex gap-4">
                        <button 
                          className={`flex items-center gap-2 h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all ${
                            post.confirmations.includes(currentUser?.uid || '') ? 'bg-emerald-500 text-white' : 'bg-white/5 text-foreground/40 hover:text-emerald-500'
                          }`}
                          onClick={() => handleInteract(post, 'confirm')}
                        >
                          <ThumbsUp className="h-3 w-3" /> {post.confirmations.length}
                        </button>
                        <button 
                          className={`flex items-center gap-2 h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all ${
                            post.disputes.includes(currentUser?.uid || '') ? 'bg-rose-500 text-white' : 'bg-white/5 text-foreground/40 hover:text-rose-500'
                          }`}
                          onClick={() => handleInteract(post, 'dispute')}
                        >
                          <ThumbsDown className="h-3 w-3" /> {post.disputes.length}
                        </button>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-20">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}

              {posts.length > visiblePosts && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setVisiblePosts(prev => prev + 10)}
                    className="h-12 px-8 rounded-xl font-black uppercase tracking-widest italic border border-white/5 hover:bg-white/5"
                  >
                    Sync Older Updates (+10)
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
