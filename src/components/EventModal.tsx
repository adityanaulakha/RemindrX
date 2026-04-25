import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded?: () => void;
}

export function EventModal({ isOpen, onClose, onEventAdded }: EventModalProps) {
  const { userData, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Core fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [category, setCategory] = useState('club');

  // Rich fields
  const [registrationLink, setRegistrationLink] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [instagramLink, setInstagramLink] = useState('');
  const [linkedinLink, setLinkedinLink] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [teamSize, setTeamSize] = useState('');

  // Dynamic custom fields
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);

  const addCustomField = () => {
    setCustomFields([...customFields, { label: '', value: '' }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, key: 'label' | 'value', val: string) => {
    const updated = [...customFields];
    updated[index][key] = val;
    setCustomFields(updated);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDate(''); setTime('');
    setEndDate(''); setEndTime('');
    setVenue(''); setOrganizer(''); setCategory('club');
    setRegistrationLink(''); setWebsiteLink('');
    setInstagramLink(''); setLinkedinLink('');
    setContactEmail(''); setContactPhone('');
    setEntryFee(''); setTeamSize('');
    setCustomFields([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.classId || !currentUser) return;

    setLoading(true);
    try {
      const eventTimestamp = new Date(`${date}T${time}`).getTime();
      const endTimestamp = endDate && endTime ? new Date(`${endDate}T${endTime}`).getTime() : undefined;

      const newEvent: Omit<Event, 'id'> = {
        title,
        description,
        date: eventTimestamp,
        ...(endTimestamp && { endDate: endTimestamp }),
        venue,
        organizer,
        category,
        createdBy: currentUser.uid,
        goingCount: 0,
        status: 'pending',
        ...(registrationLink && { registrationLink }),
        ...(websiteLink && { websiteLink }),
        ...(instagramLink && { instagramLink }),
        ...(linkedinLink && { linkedinLink }),
        ...(contactEmail && { contactEmail }),
        ...(contactPhone && { contactPhone }),
        ...(entryFee && { entryFee }),
        ...(teamSize && { teamSize }),
        ...(customFields.length > 0 && { customFields: customFields.filter(f => f.label && f.value) }),
      };

      await addDoc(collection(db, 'events'), newEvent);
      toast.success('Event submitted for approval!');
      resetForm();
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
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
          <Input label="Start Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="Start Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="End Date (optional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Input label="End Time (optional)" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Main Auditorium" required />
          <Input label="Organizer" value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="e.g. CS Club" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              <option value="workshop">Workshop</option>
              <option value="hackathon">Hackathon</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input label="Entry Fee" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} placeholder="e.g. Free, ₹200" />
        </div>

        <Input label="Team Size" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} placeholder="e.g. Solo, 2-4 members" />

        {/* Links Section */}
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-sm font-semibold mb-3 text-foreground/70">Links & Social (optional)</p>
          <div className="space-y-3">
            <Input label="Registration Link" value={registrationLink} onChange={(e) => setRegistrationLink(e.target.value)} placeholder="https://forms.google.com/..." />
            <Input label="Website" value={websiteLink} onChange={(e) => setWebsiteLink(e.target.value)} placeholder="https://techfest.college.edu" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Instagram" value={instagramLink} onChange={(e) => setInstagramLink(e.target.value)} placeholder="https://instagram.com/..." />
              <Input label="LinkedIn" value={linkedinLink} onChange={(e) => setLinkedinLink(e.target.value)} placeholder="https://linkedin.com/..." />
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="border-t border-border pt-4">
          <p className="text-sm font-semibold mb-3 text-foreground/70">Contact Info (optional)</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="club@college.edu" />
            <Input label="Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </div>

        {/* Dynamic Custom Fields */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground/70">Custom Fields</p>
            <button type="button" onClick={addCustomField} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Field
            </button>
          </div>
          {customFields.map((field, index) => (
            <div key={index} className="flex items-end gap-2 mb-2">
              <div className="flex-1">
                <Input label="Label" value={field.label} onChange={(e) => updateCustomField(index, 'label', e.target.value)} placeholder="e.g. Dress Code" />
              </div>
              <div className="flex-1">
                <Input label="Value" value={field.value} onChange={(e) => updateCustomField(index, 'value', e.target.value)} placeholder="e.g. Formals" />
              </div>
              <button type="button" onClick={() => removeCustomField(index)} className="h-10 w-10 flex items-center justify-center text-danger hover:bg-danger/10 rounded-lg shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Event'}</Button>
        </div>
      </form>
    </Modal>
  );
}
