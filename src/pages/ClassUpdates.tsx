import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Post, Subject } from '../types';
import { Button } from '../components/ui/Button';
import { ThumbsUp, ThumbsDown, MessageSquare, Plus, Edit2, Trash2, Clock, ShieldCheck, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PostModal } from '../components/PostModal';

export default function ClassUpdates() {
  const { userData, currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [subjects, setSubjects] = useState<Record<string, Subject>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    if (!userData?.classId || !currentUser) return;

    const fetchSubjects = async () => {
      const subQ = query(collection(db, 'subjects'), where('classId', '==', userData.classId));
      const snap = await getDocs(subQ);
      const subMap: Record<string, Subject> = {};
      snap.docs.forEach(doc => {
        subMap[doc.id] = { id: doc.id, ...doc.data() } as Subject;
      });
      setSubjects(subMap);
    };

    fetchSubjects();

    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const postsQuery = query(
      collection(db, 'posts'), 
      where('classId', '==', userData.classId),
      where('createdAt', '>=', oneMonthAgo)
    );

    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      fetchedPosts.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(fetchedPosts);
      setLoading(false);
    });

    return () => unsubscribePosts();
  }, [userData, currentUser]);

  const handleInteract = async (postId: string, type: 'confirm' | 'dispute') => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    let newConfirmations = post.confirmations.filter(id => id !== currentUser.uid);
    let newDisputes = post.disputes.filter(id => id !== currentUser.uid);

    if (type === 'confirm') {
      if (!post.confirmations.includes(currentUser.uid)) newConfirmations.push(currentUser.uid);
    } else {
      if (!post.disputes.includes(currentUser.uid)) newDisputes.push(currentUser.uid);
    }

    let newStatus = post.status;
    const confirmCount = newConfirmations.length;
    const disputeCount = newDisputes.length;

    if (disputeCount > confirmCount) newStatus = 'unverified';
    else if (confirmCount > 2 && disputeCount === 0) newStatus = 'verified';
    else if (confirmCount > 0) newStatus = 'likely';
    else newStatus = 'unverified';

    try {
      await updateDoc(doc(db, 'posts', postId), { confirmations: newConfirmations, disputes: newDisputes, status: newStatus });
    } catch (error) {
      toast.error('Sync error');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-12">
        <div className="h-64 bg-card/20 rounded-3xl border border-border"></div>
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-card/20 rounded-2xl border border-border"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="relative overflow-hidden rounded-3xl bg-card/60 border border-border p-10 lg:p-16 shadow-sm">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <MessageSquare className="h-64 w-64 text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-none pr-8">
              Class Updates
            </h1>
            <p className="text-sm font-medium text-muted-foreground max-w-xl">
              Notes and announcements from your section.
            </p>
          </div>

          <Button onClick={() => setIsModalOpen(true)} className="h-16 px-12 rounded-2xl font-medium shadow-2xl shadow-primary/20">
            <Plus className="mr-2 h-5 w-5" /> Post an update
          </Button>
        </div>
      </div>

      <div className="space-y-6 max-w-5xl">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-card/20 border border-dashed border-border p-24 text-center">
            <Activity className="mb-8 h-20 w-20 text-muted-foreground animate-pulse" />
            <h3 className="text-2xl font-semibold tracking-tight mb-2">No updates yet</h3>
            <p className="text-sm text-muted-foreground font-medium tracking-normal">Post something your class should know.</p>
          </div>
        ) : (
          posts.slice(0, visibleCount).map(post => {
            const hasConfirmed = post.confirmations.includes(currentUser?.uid || '');
            const hasDisputed = post.disputes.includes(currentUser?.uid || '');
            const subject = subjects[post.subjectId];

            return (
              <div key={post.id} className="group relative bg-card/40 border border-border rounded-2xl p-8 transition-all duration-500 hover:border-primary/30 hover:shadow-2xl overflow-hidden">
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                  <div className="flex-1 space-y-6">
                    <div className="flex flex-wrap items-center gap-4">
                      {subject && (
                        <div className="px-4 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                          {subject.name}
                        </div>
                      )}
                      <div className={`px-4 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                        post.status === 'verified' ? 'bg-success/10 text-success border border-success/25' :
                        post.status === 'likely' ? 'bg-warning/10 text-warning border border-warning/30' :
                        'bg-danger/10 text-danger border border-danger/25'
                      }`}>
                        {post.status === 'verified' && <ShieldCheck className="h-3 w-3" />}
                        {post.status}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground font-semibold text-xs tracking-normal">
                        <Clock className="h-3 w-3" />
                        {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="ml-1 opacity-50">• {new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    
                    <p className="text-lg font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  </div>

                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-4 shrink-0">
                    {currentUser?.uid === post.createdBy && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingPost(post); setIsModalOpen(true); }}
                          className="h-10 w-10 p-0 rounded-xl bg-muted border border-border hover:bg-primary/20 hover:text-primary transition-all"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { if(confirm('Delete this update?')) deleteDoc(doc(db, 'posts', post.id)); }}
                          className="h-10 w-10 p-0 rounded-xl bg-muted border border-border hover:bg-danger/15 hover:text-danger transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleInteract(post.id, 'confirm')}
                        className={`flex items-center gap-3 h-12 px-6 rounded-2xl text-xs font-medium transition-all ${
                          hasConfirmed ? 'bg-success text-success-foreground shadow-xl shadow-success/20' : 'bg-muted border border-border text-muted-foreground hover:text-success'
                        }`}
                      >
                        <ThumbsUp className={`h-4 w-4 ${hasConfirmed ? '' : ''}`} />
                        {post.confirmations.length}
                      </button>
                      <button
                        onClick={() => handleInteract(post.id, 'dispute')}
                        className={`flex items-center gap-3 h-12 px-6 rounded-2xl text-xs font-medium transition-all ${
                          hasDisputed ? 'bg-danger text-danger-foreground shadow-xl shadow-danger/20' : 'bg-muted border border-border text-muted-foreground hover:text-danger'
                        }`}
                      >
                        <ThumbsDown className={`h-4 w-4 ${hasDisputed ? '' : ''}`} />
                        {post.disputes.length}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {posts.length > visibleCount && (
          <div className="flex justify-center pt-8">
            <Button 
              variant="ghost" 
              onClick={() => setVisibleCount(prev => prev + 10)}
              className="h-14 px-12 rounded-2xl font-medium border border-border hover:bg-muted"
            >
              Show older updates
            </Button>
          </div>
        )}
      </div>

      <PostModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingPost(null); }} 
        editPost={editingPost}
      />
    </div>
  );
}
