import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { computePostStatus, toggleVote } from '../utils/postStatus';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Post, Subject } from '../types';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';
import { ThumbsUp, ThumbsDown, MessageSquare, Plus, Edit2, Trash2, Clock, ShieldCheck } from 'lucide-react';
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

  const classId = userData?.classId;
  const uid = currentUser?.uid;

  useEffect(() => {
    if (!classId || !uid) return;

    const fetchSubjects = async () => {
      const subQ = query(collection(db, 'subjects'), where('classId', '==', classId), limit(200));
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
      where('classId', '==', classId),
      where('createdAt', '>=', oneMonthAgo),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      fetchedPosts.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(fetchedPosts);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribePosts();
  }, [classId, uid]);

  const handleInteract = async (postId: string, type: 'confirm' | 'dispute') => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const { confirmations: newConfirmations, disputes: newDisputes } = toggleVote(post, currentUser.uid, type);
    const repConfirming = userData?.role === 'admin' && newConfirmations.includes(currentUser.uid);
    const newStatus = computePostStatus(newConfirmations, newDisputes, repConfirming);

    try {
      await updateDoc(doc(db, 'posts', postId), { confirmations: newConfirmations, disputes: newDisputes, status: newStatus });
    } catch {
      toast.error('Sync error');
    }
  };

  if (loading) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Section feed"
        title="Class Updates"
        description="Notes and announcements from your section."
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" /> Post an update
          </Button>
        }
      />

      <div className="max-w-5xl space-y-4">
        {posts.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No updates yet"
            description="Post something your class should know."
          />
        ) : (
          posts.slice(0, visibleCount).map(post => {
            const hasConfirmed = post.confirmations.includes(currentUser?.uid || '');
            const hasDisputed = post.disputes.includes(currentUser?.uid || '');
            const subject = subjects[post.subjectId];

            return (
              <Card key={post.id} className="group overflow-hidden p-5 sm:p-6">
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
              </Card>
            );
          })
        )}

        {posts.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <Button variant="secondary" onClick={() => setVisibleCount(prev => prev + 10)}>
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
