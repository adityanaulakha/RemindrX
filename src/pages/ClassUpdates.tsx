import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Post, Subject } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ThumbsUp, ThumbsDown, MessageSquare, AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PostModal } from '../components/PostModal';

export default function ClassUpdates() {
  const { userData, currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [subjects, setSubjects] = useState<Record<string, Subject>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!userData?.classId || !currentUser) return;

    // Fetch subjects once to map subjectId to name
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

    // Listen to all posts in this class
    const postsQuery = query(collection(db, 'posts'), where('classId', '==', userData.classId));
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      fetchedPosts.sort((a, b) => b.createdAt - a.createdAt); // Newest first
      setPosts(fetchedPosts);
      setLoading(false);
    });

    return () => unsubscribePosts();
  }, [userData, currentUser]);

  const handleInteract = async (postId: string, type: 'confirm' | 'dispute') => {
    if (!currentUser) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Remove user from opposite array if they are switching
    let newConfirmations = post.confirmations.filter(id => id !== currentUser.uid);
    let newDisputes = post.disputes.filter(id => id !== currentUser.uid);

    // Toggle current selection
    if (type === 'confirm') {
      if (!post.confirmations.includes(currentUser.uid)) {
        newConfirmations.push(currentUser.uid);
      } else {
        // Un-confirm
        newConfirmations = newConfirmations.filter(id => id !== currentUser.uid);
      }
    } else {
      if (!post.disputes.includes(currentUser.uid)) {
        newDisputes.push(currentUser.uid);
      } else {
        // Un-dispute
        newDisputes = newDisputes.filter(id => id !== currentUser.uid);
      }
    }

    // Determine new status
    let newStatus = post.status;
    const confirmCount = newConfirmations.length;
    const disputeCount = newDisputes.length;

    if (disputeCount > confirmCount) {
      newStatus = 'unverified';
    } else if (confirmCount > 2 && disputeCount === 0) {
      newStatus = 'verified';
    } else if (confirmCount > 0) {
      newStatus = 'likely';
    } else {
      newStatus = 'unverified';
    }

    try {
      await updateDoc(doc(db, 'posts', postId), {
        confirmations: newConfirmations,
        disputes: newDisputes,
        status: newStatus
      });
    } catch (error) {
      toast.error('Failed to update interaction');
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-12 w-48 bg-card rounded-lg mb-6"></div>
      <div className="h-40 bg-card rounded-xl"></div>
      <div className="h-40 bg-card rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Updates</h1>
          <p className="text-foreground/60">Real-time crowdsourced updates for all your subjects</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Post Update
        </Button>
      </div>

      <div className="space-y-4 max-w-4xl mt-6">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <MessageSquare className="h-12 w-12 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No updates yet</h3>
            <p className="text-foreground/60 mt-1">Be the first to share an update with your class!</p>
          </div>
        ) : (
          posts.map(post => {
            const hasConfirmed = post.confirmations.includes(currentUser?.uid || '');
            const hasDisputed = post.disputes.includes(currentUser?.uid || '');
            const subject = subjects[post.subjectId];

            return (
              <Card key={post.id} className="border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {subject && (
                          <span className="px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full bg-primary/10 text-primary">
                            {subject.name}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                          post.status === 'verified' ? 'bg-success/20 text-success' :
                          post.status === 'likely' ? 'bg-warning/20 text-warning' :
                          'bg-danger/20 text-danger'
                        }`}>
                          {post.status}
                        </span>
                        <span className="text-xs text-foreground/40">• {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      
                      <p className="text-base text-foreground/90 whitespace-pre-wrap">{post.content}</p>
                    </div>

                    <div className="flex md:flex-col gap-2 shrink-0 items-end justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleInteract(post.id, 'confirm')}
                        className={`text-xs ${hasConfirmed ? 'bg-success/20 text-success hover:bg-success/30 hover:text-success' : 'hover:text-success'}`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                        Confirm ({post.confirmations.length})
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleInteract(post.id, 'dispute')}
                        className={`text-xs ${hasDisputed ? 'bg-danger/20 text-danger hover:bg-danger/30 hover:text-danger' : 'hover:text-danger'}`}
                      >
                        <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                        Dispute ({post.disputes.length})
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <PostModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
