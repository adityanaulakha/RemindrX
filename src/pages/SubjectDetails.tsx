import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject, Post, Task } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MessageSquare, ThumbsUp, ThumbsDown, ShieldCheck, ArrowLeft, CheckSquare, FileText, Calendar, Clock, AlertTriangle } from 'lucide-react';
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

  useEffect(() => {
    if (!id || !userData?.classId) return;

    // Fetch Subject Details
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

    // Listen for Posts
    const postsQuery = query(collection(db, 'posts'), where('subjectId', '==', id));
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      fetchedPosts.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(fetchedPosts);
    });

    // Listen for Tasks
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
      toast.success('Update posted!');
    } catch (error) {
      toast.error('Failed to post update');
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

      if (newStatus === 'verified' && post.status !== 'verified') {
        toast.success("Post Verified! Creator earned Trust Score.");
      }

    } catch (error) {
      toast.error('Interaction failed');
    }
  };

  const now = Date.now();
  const isPast = (deadline: number) => deadline < now;
  const isCritical = (deadline: number, priority: string) => !isPast(deadline) && (deadline <= now + 48 * 60 * 60 * 1000 || priority === 'critical');

  if (loading || !subject) {
    return <div className="animate-pulse h-64 bg-card rounded-xl"></div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/subjects')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{subject.name}</h1>
          <p className="text-foreground/60">{subject.code} • {subject.type === 'theory' ? 'Theory' : 'Lab'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
          }`}
        >
          <CheckSquare className="h-4 w-4" /> Tasks
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'resources' ? 'border-primary text-primary' : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
          }`}
        >
          <FileText className="h-4 w-4" /> Resources
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'updates' ? 'border-primary text-primary' : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Updates
        </button>
      </div>

      <div className="mt-6">
        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div className="space-y-4 max-w-4xl">
            {tasks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckSquare className="h-12 w-12 text-foreground/20 mb-4" />
                  <h3 className="text-lg font-semibold">No tasks yet</h3>
                  <p className="text-foreground/60 mt-1">Add an assignment or deadline for this subject using the global '+' button.</p>
                </CardContent>
              </Card>
            ) : (
              tasks.map(task => (
                <div key={task.id} className={`rounded-xl border p-5 shadow-sm transition-all ${
                  isCritical(task.deadline, task.priority) && !isPast(task.deadline)
                    ? 'border-danger/30 bg-danger/5' 
                    : 'border-border bg-card'
                } ${isPast(task.deadline) ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${
                          task.priority === 'critical' ? 'bg-danger/20 text-danger' :
                          task.priority === 'medium' ? 'bg-accent/20 text-accent' :
                          'bg-foreground/10 text-foreground/70'
                        }`}>
                          {task.priority}
                        </span>
                        {isCritical(task.deadline, task.priority) && !isPast(task.deadline) && (
                          <span className="flex items-center text-xs font-bold text-danger">
                            <AlertTriangle className="h-3 w-3 mr-1" /> URGENT
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold leading-tight">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-foreground/70 mt-2 whitespace-pre-wrap">{task.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-foreground/60 shrink-0 bg-background/50 px-3 py-2 rounded-lg border border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* RESOURCES TAB */}
        {activeTab === 'resources' && (
          <Card className="max-w-4xl">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold">Resources</h3>
              <p className="text-foreground/60 mt-1">Upload notes, PDFs, and links for this subject.</p>
              <p className="text-xs text-primary mt-4 uppercase tracking-widest font-bold">Coming Soon</p>
            </CardContent>
          </Card>
        )}

        {/* UPDATES TAB */}
        {activeTab === 'updates' && (
          <div className="max-w-4xl space-y-6">
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleCreatePost} className="mb-6 flex gap-2">
                  <Input
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Share an update (e.g., 'Assignment deadline extended')"
                    className="flex-1"
                  />
                  <Button type="submit">Post</Button>
                </form>

                <div className="space-y-4">
                  {posts.length === 0 ? (
                    <p className="text-center text-foreground/50 py-4">No updates yet.</p>
                  ) : (
                    posts.map(post => (
                      <div key={post.id} className="rounded-xl border border-border p-4 bg-card/50">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-sm font-medium">{post.content}</p>
                          <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full shrink-0 ml-4 flex items-center ${
                            post.status === 'verified' ? 'bg-green-500/20 text-green-500' :
                            post.status === 'likely' ? 'bg-blue-500/20 text-blue-500' :
                            'bg-foreground/10 text-foreground/70'
                          }`}>
                            {post.status === 'verified' && <ShieldCheck className="h-3 w-3 mr-1" />}
                            {post.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`h-8 px-2 text-xs ${post.confirmations.includes(currentUser?.uid || '') ? 'text-primary bg-primary/10' : ''}`}
                            onClick={() => handleInteract(post, 'confirm')}
                          >
                            <ThumbsUp className="mr-1.5 h-3 w-3" /> {post.confirmations.length}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`h-8 px-2 text-xs ${post.disputes.includes(currentUser?.uid || '') ? 'text-danger bg-danger/10' : ''}`}
                            onClick={() => handleInteract(post, 'dispute')}
                          >
                            <ThumbsDown className="mr-1.5 h-3 w-3" /> {post.disputes.length}
                          </Button>
                          <span className="text-xs text-foreground/40 ml-auto">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
