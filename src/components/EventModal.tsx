import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from 'react-hot-toast';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded?: () => void;
}

export function EventModal({ isOpen, onClose, onEventAdded }: EventModalProps) {
  const { userData, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [category, setCategory] = useState('club');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.classId || !currentUser) return;

    setLoading(true);
    try {
      const eventTimestamp = new Date(`${date}T${time}`).getTime();

      const newEvent: Omit<Event, 'id'> = {
        title,
        description,
        date: eventTimestamp,
        venue,
        organizer,
        category,
        createdBy: currentUser.uid,
        goingCount: 0,
        status: 'pending'
      };

      await addDoc(collection(db, 'events'), newEvent);
      toast.success('Event created successfully!');
      
      // Reset
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setVenue('');
      setOrganizer('');
      setCategory('club');
      
      onClose();
      if (onEventAdded) onEventAdded();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Event">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Event Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Annual Tech Fest"
          required
        />
        
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/80">Description</label>
          <textarea
            className="flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this event about?"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Main Auditorium" required />
          <Input label="Organizer" value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="e.g. CS Club" required />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/80">Category</label>
          <select
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="academic">Academic</option>
            <option value="club">Club / Society</option>
            <option value="sports">Sports</option>
            <option value="cultural">Cultural</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Event'}</Button>
        </div>
      </form>
    </Modal>
  );
}
