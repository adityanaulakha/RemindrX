import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from 'react-hot-toast';
import type { ClassData, Institute } from '../types';

interface CreateSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSectionCreated?: () => void;
}

const PROGRAMS = ['B.Tech', 'M.Tech', 'BCA', 'MCA'];
const BRANCHES = ['CSE Core', 'CSE Specialization', 'CSE Honors', 'ECE', 'ME', 'CE'];
const YEARS = ['1', '2', '3', '4'];

export function CreateSectionModal({ isOpen, onClose, onSectionCreated }: CreateSectionModalProps) {
  const [loading, setLoading] = useState(false);
  const [program, setProgram] = useState(PROGRAMS[0]);
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [year, setYear] = useState(YEARS[0]);
  const [section, setSection] = useState('A');
  const [adminCode, setAdminCode] = useState('');
  const [adminLimit, setAdminLimit] = useState(2);
  const [joinCode, setJoinCode] = useState('');
  
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selectedInstituteId, setSelectedInstituteId] = useState('');

  // Fetch institutes
  useEffect(() => {
    if (isOpen) {
      const fetchInsts = async () => {
        const snap = await getDocs(query(collection(db, 'institutes'), orderBy('name')));
        const insts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Institute));
        setInstitutes(insts);
        if (insts.length > 0) setSelectedInstituteId(insts[0].id);
      };
      fetchInsts();
    }
  }, [isOpen]);

  // Auto-generate join code pattern
  useEffect(() => {
    if (isOpen) {
      const p = program.replace(/[^A-Z]/g, ''); // B.Tech -> BT
      const b = branch.replace(/[^A-Za-z]/g, '').toUpperCase(); // CSE Core -> CSECORE
      const code = `${p}-${b}-Y${year}-${section.toUpperCase()}`;
      setJoinCode(code);
      setAdminCode(`CR-${code}-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [program, branch, year, section, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!section.trim() || !adminCode.trim() || adminLimit < 1 || !selectedInstituteId) {
      toast.error('Please fill all required fields correctly');
      return;
    }

    setLoading(true);
    try {
      // Check if joinCode is strictly unique
      const q = query(collection(db, 'classes'), where('joinCode', '==', joinCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Check if there's a collision in the currently selected institute
        const sameInstituteMatch = snap.docs.find(doc => doc.data().instituteId === selectedInstituteId);
        
        if (sameInstituteMatch) {
          toast.error('This section already exists in the selected institute. Please delete it first to recreate.');
        } else {
          toast.error('A section with this automatically generated code already exists! Please change the section name slightly.');
        }
        setLoading(false);
        return;
      }

      const newSection: Omit<ClassData, 'id'> = {
        name: `${program} ${branch} - Year ${year} Section ${section.toUpperCase()}`,
        program,
        branch,
        year,
        section: section.toUpperCase(),
        joinCode,
        adminInviteCode: adminCode,
        adminCodeUses: adminLimit,
        admins: [],
        instituteId: selectedInstituteId
      };

      await addDoc(collection(db, 'classes'), newSection);
      toast.success('Section created successfully!');
      
      onClose();
      if (onSectionCreated) onSectionCreated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create section');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Section">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/80">Institute / College</label>
          <select
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={selectedInstituteId}
            onChange={(e) => setSelectedInstituteId(e.target.value)}
            required
          >
            <option value="" disabled>Select your college...</option>
            {institutes.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
          {institutes.length === 0 && <p className="text-[10px] text-danger mt-1">No institutes found. Create one in Super Admin first.</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/80">Program</label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
            >
              {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/80">Branch</label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/80">Year</label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <Input
            label="Section"
            type="text"
            placeholder="e.g. A"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            required
          />
        </div>

        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-3">
          <div>
            <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Generated Section Code</p>
            <p className="font-mono text-lg">{joinCode}</p>
            <p className="text-[10px] text-foreground/50 mt-1">Students will use this exact code to join this section.</p>
          </div>
          <div className="pt-2 border-t border-primary/10">
            <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Generated Admin Invite Code</p>
            <p className="font-mono text-lg">{adminCode}</p>
            <p className="text-[10px] text-foreground/50 mt-1">Unique code for Class Representatives to get admin rights.</p>
          </div>
        </div>

        <div>
          <Input
            label="Admin Code Usage Limit"
            type="number"
            min={1}
            max={10}
            value={adminLimit.toString()}
            onChange={(e) => setAdminLimit(parseInt(e.target.value) || 1)}
            required
          />
          <p className="text-[10px] text-foreground/50 mt-1">How many CRs can use this admin code.</p>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Section'}</Button>
        </div>
      </form>
    </Modal>
  );
}
