import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject, Post } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MessageSquare, ThumbsUp, ThumbsDown, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SubjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData, currentUser } = useAuth();
  
  const [subject, setSubject] = useState<Subject | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);

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

    // Listen for Posts in real-time
    const postsQuery = query(
      collection(db, 'posts'),
      where('subjectId', '==', id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(fetchedPosts);
      setLoading(false);
    });

    return () => unsubscribePosts();
  }, [id, userData, navigate]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !currentUser || !id) return;

    try {
      const newPost: Omit<Post, 'id'> = {
        content: newPostContent.trim(),
        subjectId: id,
        confirmations: [currentUser.uid], // Creator auto-confirms
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

    if (isConfirm && hasConfirmed) return; // Already confirmed
    if (!isConfirm && hasDisputed) return; // Already disputed

    try {
      const postRef = doc(db, 'posts', post.id);
      let newConfirmations = [...post.confirmations];
      let newDisputes = [...post.disputes];

      if (isConfirm) {
        newConfirmations.push(currentUser.uid);
        newDisputes = newDisputes.filter(uid => uid !== currentUser.uid); // Remove from disputes if changing mind
      } else {
        newDisputes.push(currentUser.uid);
        newConfirmations = newConfirmations.filter(uid => uid !== currentUser.uid); // Remove from confirms if changing mind
      }

      // Calculate status based on business logic
      let newStatus = post.status;
      if (newConfirmations.length >= 10 || userData.role === 'admin') {
        newStatus = 'verified';
      } else if (newConfirmations.length >= 5) {
        newStatus = 'likely';
      } else if (newDisputes.length > newConfirmations.length) {
        newStatus = 'unverified'; // Downgrade if heavily disputed
      }

      await updateDoc(postRef, {
        confirmations: newConfirmations,
        disputes: newDisputes,
        status: newStatus
      });

      // Trust Score System: Reward original poster if verified
      if (newStatus === 'verified' && post.status !== 'verified') {
        await updateDoc(doc(db, 'users', post.createdBy), {
          trustScore: increment(10)
        });
        toast.success("Post Verified! Creator earned Trust Score.");
      }

    } catch (error) {
      toast.error('Interaction failed');
    }
  };

  if (loading || !subject) {
    return <div className="animate-pulse h-64 bg-card rounded-xl"></div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/subjects')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Subjects
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{subject.name}</h1>
          <p className="text-foreground/60">{subject.code} • {subject.type === 'theory' ? 'Theory' : 'Lab'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Class Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/60 text-center py-4">Resources feature coming soon.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
