import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject, Post } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { toast } from 'react-hot-toast';
import { BookOpen, MessageSquare, Zap } from 'lucide-react';

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostAdded?: () => void;
  defaultSubjectId?: string;
  editPost?: Post | null;
}

export function PostModal({ isOpen, onClose, onPostAdded, defaultSubjectId, editPost }: PostModalProps) {
  const { userData, currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editPost) {
        setContent(editPost.content);
        setSubjectId(editPost.subjectId);
      } else {
        setContent('');
        setSubjectId(defaultSubjectId || '');
      }
      
      if (userData?.classId) {
        fetchSubjects();
      }
    }
  }, [isOpen, userData, defaultSubjectId, editPost]);

  const fetchSubjects = async () => {
    try {
      const q = query(
        collection(db, 'subjects'),
        where('classId', '==', userData!.classId),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const fetchedSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(fetchedSubjects);
      if (fetchedSubjects.length > 0 && !subjectId && !defaultSubjectId) {
        setSubjectId(fetchedSubjects[0].id);
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.classId || !currentUser || !subjectId || !content.trim()) {
      toast.error('Matrix inputs incomplete');
      return;
    }

    setLoading(true);
    try {
      if (editPost) {
        await updateDoc(doc(db, 'posts', editPost.id), {
          content: content.trim(),
          subjectId,
          status: 'unverified',
          confirmations: [currentUser.uid],
          disputes: [],
          updatedAt: Date.now()
        });
        toast.success('Update Resynced');
      } else {
        const newPost: Omit<Post, 'id'> = {
          content: content.trim(),
          subjectId,
          classId: userData.classId,
          confirmations: [currentUser.uid],
          disputes: [],
          status: 'unverified',
          createdAt: Date.now(),
          createdBy: currentUser.uid,
        };
        await addDoc(collection(db, 'posts'), newPost);
        toast.success('Intelligence Broadcasted');
      }
      
      setContent('');
      onClose();
      if (onPostAdded) onPostAdded();
    } catch (error: any) {
      toast.error('Broadcast failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editPost ? "Modify Intelligence" : "Broadcast Intelligence"}>
      <form onSubmit={handleSubmit} className="space-y-8 py-4">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 flex items-center gap-2 ml-1">
            <BookOpen className="h-3 w-3" /> Core Subject
          </label>
          <div className="relative group">
            <select
              className="flex h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-bold italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all appearance-none"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            >
              <option value="" disabled className="bg-background">Select Cluster...</option>
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id} className="bg-background">{sub.name}</option>
              ))}
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
              <Zap className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 flex items-center gap-2 ml-1">
            <MessageSquare className="h-3 w-3" /> Information Load
          </label>
          <textarea
            className="flex w-full rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 min-h-[160px] resize-none leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Broadcast tomorrow's schedule shift or urgent updates..."
            required
          />
        </div>

        <div className="pt-4 flex gap-4">
          <Button type="button" variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest italic" onClick={onClose}>Abort</Button>
          <Button type="submit" className="flex-2 h-14 px-10 rounded-2xl font-black uppercase tracking-widest italic shadow-xl shadow-primary/20" disabled={loading}>
            {loading ? 'Broadcasting...' : (editPost ? 'Push Update' : 'Initialize Broadcast')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
