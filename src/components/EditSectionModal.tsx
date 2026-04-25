import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from 'react-hot-toast';
import type { ClassData } from '../types';

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

  useEffect(() => {
    if (isOpen && section) {
      setAdminCode(section.adminInviteCode || '');
      setAdminLimit(section.adminCodeUses || 2);
      setName(section.name || '');
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
        adminCodeUses: adminLimit
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
        
        <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 mb-4">
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
