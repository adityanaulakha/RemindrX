import { useState, useEffect } from 'react';
import { collection, doc, updateDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from 'react-hot-toast';
import type { ClassData, Institute } from '../types';

interface EditSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: ClassData | null;
  onSectionUpdated?: () => void;
}

export function EditSectionModal({ isOpen, onClose, section, onSectionUpdated }: EditSectionModalProps) {
  const [loading, setLoading] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminLimit, setAdminLimit] = useState(2);
  const [name, setName] = useState('');
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selectedInstituteId, setSelectedInstituteId] = useState('');
  const [year, setYear] = useState('');
  const [sectionTag, setSectionTag] = useState('');

  useEffect(() => {
    if (isOpen && section) {
      setAdminCode(section.adminInviteCode || '');
      setAdminLimit(section.adminCodeUses || 2);
      setName(section.name || '');
      setSelectedInstituteId(section.instituteId || '');
      setYear(section.year || '');
      setSectionTag(section.section || '');
      
      const fetchInsts = async () => {
        const snap = await getDocs(query(collection(db, 'institutes'), orderBy('name')));
        setInstitutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Institute)));
      };
      fetchInsts();
    }
  }, [isOpen, section]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!section || !adminCode.trim() || adminLimit < 1 || !name.trim()) {
      toast.error('Please fill all fields correctly');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'classes', section.id), {
        name,
        adminInviteCode: adminCode,
        adminCodeUses: adminLimit,
        instituteId: selectedInstituteId,
        year,
        section: sectionTag
      });
      toast.success('Section updated successfully!');
      
      onClose();
      if (onSectionUpdated) onSectionUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update section');
    } finally {
      setLoading(false);
    }
  };

  if (!section) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Section Settings">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="space-y-4">
          <label className="block text-sm font-bold text-foreground/80">Associated Institute</label>
          <select
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={selectedInstituteId}
            onChange={(e) => setSelectedInstituteId(e.target.value)}
            required
          >
            <option value="" disabled>Select Institute...</option>
            {institutes.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>

        <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 my-4">
          <p className="text-xs text-foreground/50 uppercase tracking-wider mb-1 font-bold">Section Code (Immutable)</p>
          <p className="font-mono text-lg font-bold text-accent">{section.joinCode}</p>
          <p className="text-[10px] text-foreground/50 mt-1">To change the taxonomy or join code, please delete and recreate the section.</p>
        </div>

        <Input
          label="Section Display Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-foreground/80 mb-1.5">Academic Year</label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            >
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>
          <Input
            label="Section Tag"
            value={sectionTag}
            onChange={(e) => setSectionTag(e.target.value.toUpperCase())}
            placeholder="e.g. A"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="col-span-2">
            <Input
              label="Admin Invite Code (For CRs)"
              type="text"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              label="Usage Limit"
              type="number"
              min={0}
              max={10}
              value={adminLimit.toString()}
              onChange={(e) => setAdminLimit(parseInt(e.target.value) || 0)}
              required
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </form>
    </Modal>
  );
}
