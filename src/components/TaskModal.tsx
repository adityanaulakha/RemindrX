import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Subject, Task, Priority } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from 'react-hot-toast';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded?: () => void;
}

export function TaskModal({ isOpen, onClose, onTaskAdded }: TaskModalProps) {
  const { userData, currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  useEffect(() => {
    if (isOpen && userData?.classId) {
      fetchSubjects();
    }
  }, [isOpen, userData]);

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
      if (fetchedSubjects.length > 0 && !subjectId) {
        setSubjectId(fetchedSubjects[0].id);
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.classId || !currentUser || !subjectId) {
      toast.error('Please select a subject');
      return;
    }

    setLoading(true);
    try {
      // Combine date and time
      const deadlineTimestamp = new Date(`${deadlineDate}T${deadlineTime}`).getTime();

      const newTask: Omit<Task, 'id'> = {
        title,
        description,
        subjectId,
        classId: userData.classId, // Adding classId directly for easier querying
        deadline: deadlineTimestamp,
        priority,
        createdBy: currentUser.uid,
      };

      await addDoc(collection(db, 'tasks'), newTask);
      toast.success('Task created successfully!');
      
      // Reset and close
      setTitle('');
      setDescription('');
      setDeadlineDate('');
      setDeadlineTime('');
      setPriority('medium');
      onClose();
      if (onTaskAdded) onTaskAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Task Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Assignment 1"
          required
        />
        
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/80">Description</label>
          <textarea
            className="flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details about the task..."
          />
        </div>

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

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Deadline Date"
            type="date"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            required
          />
          <Input
            label="Deadline Time"
            type="time"
            value={deadlineTime}
            onChange={(e) => setDeadlineTime(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/80">Priority</label>
          <select
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Create Task'}</Button>
        </div>
      </form>
    </Modal>
  );
}
