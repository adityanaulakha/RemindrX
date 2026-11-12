import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject, Post, Task } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { MessageSquare, ThumbsUp, ThumbsDown, ShieldCheck, ArrowLeft, CheckSquare, Calendar, Clock, AlertTriangle, Activity } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'tasks' | 'updates'>('tasks');
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
          toast.error("Subject not found");
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
      if (!userData?.classId) {
        toast.error('Missing section — re-enroll from the portal');
        return;
      }
      const newPost: Omit<Post, 'id'> = {
        content: newPostContent.trim(),
        subjectId: id,
        classId: userData.classId,
        confirmations: [currentUser.uid],
        disputes: [],
        status: 'unverified',
        createdAt: Date.now(),
        createdBy: currentUser.uid,
      };

      await addDoc(collection(db, 'posts'), newPost);
      setNewPostContent('');
      toast.success('Update posted');
    } catch (error) {
      toast.error('Could not post the update');
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

  if (loading || !subject) return <PageSkeleton rows={3} />;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" className="h-10 w-10 p-0" onClick={() => navigate('/subjects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-px flex-1 bg-border" />
      </div>

      <PageHeader
        eyebrow={`${subject.code.toUpperCase()} · ${subject.type}`}
        title={subject.name}
        description={`${subject.credits || 0} credits · ${tasks.length} active tasks`}
        actions={
          <>
            <Badge tone={subject.type === 'theory' ? 'primary' : 'accent'}>{subject.type}</Badge>
            <Badge>{subject.credits || 0} credits</Badge>
          </>
        }
      />

      <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-border bg-muted/60 p-1.5 no-scrollbar">
        {[
          { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
          { id: 'updates', icon: MessageSquare, label: 'Updates' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === tab.id ? 'bg-primary text-primary-foreground ' : 'text-muted-foreground hover:text-foreground'
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
              <div className="flex flex-col items-center justify-center rounded-3xl bg-card/20 border border-dashed border-border p-24 text-center">
                <Activity className="mb-8 h-20 w-20 text-muted-foreground" />
                <h3 className="text-2xl font-semibold tracking-tight mb-2">No tasks yet</h3>
                <p className="text-sm text-muted-foreground font-medium tracking-normal">This subject does not have any tasks.</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className={`group relative rounded-2xl border p-8 transition-all duration-500  ${
                  isCritical(task.deadline, task.priority) && !isPast(task.deadline)
                    ? 'bg-danger/10 border-danger/30' 
                    : 'bg-card/40 border-border '
                } ${isPast(task.deadline) ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className={`px-4 py-1.5 rounded-xl text-xs font-medium ${
                          task.priority === 'critical' ? 'bg-danger text-danger-foreground' :
                          task.priority === 'medium' ? 'bg-warning text-warning-foreground' :
                          'bg-muted text-foreground/60'
                        }`}>
                          {task.priority}
                        </div>
                        {isCritical(task.deadline, task.priority) && !isPast(task.deadline) && (
                          <div className="flex items-center gap-2 text-danger text-xs font-medium animate-pulse">
                            <AlertTriangle className="h-3 w-3" /> Due soon
                          </div>
                        )}
                      </div>
                      <h3 className="text-2xl font-semibold tracking-tight group-hover:text-primary transition-colors">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-2xl">{task.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-6 p-6 rounded-3xl bg-muted border border-border shrink-0">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Deadline</p>
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          <Calendar className="h-4 w-4 text-primary" />
                          {new Date(task.deadline).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="h-8 w-px bg-muted" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Posted</p>
                        <div className="flex items-center gap-2 font-semibold text-sm">
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

        {activeTab === 'updates' && (
          <div className="space-y-8">
            <form onSubmit={handleCreatePost} className="relative group">
              <input
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Share an update for this subject"
                className="w-full h-20 pl-8 pr-32 rounded-2xl bg-card/40 border border-border text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <Button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 h-14 px-8 rounded-2xl font-medium">
                Post
              </Button>
            </form>

            <div className="space-y-6">
              {posts.length === 0 ? (
                <div className="text-center py-12 font-medium text-muted-foreground text-xs">No updates for this subject yet.</div>
              ) : (
                posts.slice(0, visiblePosts).map(post => (
                  <div key={post.id} className="rounded-2xl bg-card/40 border border-border p-8 space-y-6">
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-lg font-medium text-foreground/80 leading-relaxed">{post.content}</p>
                      <div className={`px-4 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 shrink-0 ${
                        post.status === 'verified' ? 'bg-success/10 text-success border border-success/25' :
                        post.status === 'likely' ? 'bg-warning/10 text-warning border border-warning/30' :
                        'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {post.status === 'verified' && <ShieldCheck className="h-3 w-3" />}
                        {post.status}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-6 border-t border-border">
                      <div className="flex gap-4">
                        <button 
                          className={`flex items-center gap-2 h-10 px-5 rounded-xl text-xs font-medium transition-all ${
                            post.confirmations.includes(currentUser?.uid || '') ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground hover:text-success'
                          }`}
                          onClick={() => handleInteract(post, 'confirm')}
                        >
                          <ThumbsUp className="h-3 w-3" /> {post.confirmations.length}
                        </button>
                        <button 
                          className={`flex items-center gap-2 h-10 px-5 rounded-xl text-xs font-medium transition-all ${
                            post.disputes.includes(currentUser?.uid || '') ? 'bg-danger text-danger-foreground' : 'bg-muted text-muted-foreground hover:text-danger'
                          }`}
                          onClick={() => handleInteract(post, 'dispute')}
                        >
                          <ThumbsDown className="h-3 w-3" /> {post.disputes.length}
                        </button>
                      </div>
                      <span className="text-xs font-medium opacity-20">
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
                    className="h-12 px-8 rounded-xl font-medium border border-border hover:bg-muted"
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
