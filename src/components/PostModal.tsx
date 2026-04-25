import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject, Post } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { toast } from 'react-hot-toast';

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostAdded?: () => void;
  defaultSubjectId?: string;
}

export function PostModal({ isOpen, onClose, onPostAdded, defaultSubjectId }: PostModalProps) {
  const { userData, currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState('');

  useEffect(() => {
    if (isOpen && userData?.classId) {
      fetchSubjects();
      if (defaultSubjectId) setSubjectId(defaultSubjectId);
    }
  }, [isOpen, userData, defaultSubjectId]);

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
      toast.error('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const newPost: Omit<Post, 'id'> = {
        content: content.trim(),
        subjectId,
        classId: userData.classId,
        confirmations: [currentUser.uid], // Creator auto-confirms
        disputes: [],
        status: 'unverified',
        createdAt: Date.now(),
        createdBy: currentUser.uid,
      };

      await addDoc(collection(db, 'posts'), newPost);
      toast.success('Update posted successfully!');
      
      // Reset and close
      setContent('');
      onClose();
      if (onPostAdded) onPostAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post Class Update">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/80">Subject</label>
          <select
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
          >
            <option value="" disabled>Select a subject</option>
            {subjects.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name} ({sub.type})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/80">Update Details</label>
          <textarea
            className="flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[100px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="e.g. Tomorrow's lab is shifted to 2 PM"
            required
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Posting...' : 'Post Update'}</Button>
        </div>
      </form>
    </Modal>
  );
}
