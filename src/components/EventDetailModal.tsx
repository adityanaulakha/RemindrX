import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Calendar, Clock, MapPin, Users, Globe, ExternalLink, Mail, Phone, DollarSign, Users2, Edit2, Plus, Trash2, AlertTriangle, Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Inlined Brand Icons (since Lucide removed them)
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>
  </svg>
);

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  isGoing?: boolean;
  onToggleParticipation?: (event: Event) => void;
  onApprove?: (eventId: string, remarks: string) => void;
  onReject?: (eventId: string, remarks: string) => void;
  onDelete?: (eventId: string, remarks: string) => void;
  isAdminView?: boolean;
}

export function EventDetailModal({ 
  isOpen, 
  onClose, 
  event, 
  isGoing, 
  onToggleParticipation,
  onApprove,
  onReject,
  onDelete,
  isAdminView = false
}: EventDetailModalProps) {
  const { currentUser, userData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState('');

  // Edit state
  // ... (keep all edit state variables as they are)
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editOrganizer, setEditOrganizer] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRegistrationLink, setEditRegistrationLink] = useState('');
  const [editWebsiteLink, setEditWebsiteLink] = useState('');
  const [editInstagramLink, setEditInstagramLink] = useState('');
  const [editLinkedinLink, setEditLinkedinLink] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editEntryFee, setEditEntryFee] = useState('');
  const [editTeamSize, setEditTeamSize] = useState('');
  const [editCustomFields, setEditCustomFields] = useState<{ label: string; value: string }[]>([]);

  if (!event) return null;

  const isCreator = currentUser?.uid === event.createdBy;
  const isSuperAdmin = userData?.isSuperAdmin;

  const startEditing = () => {
    const d = new Date(event.date);
    setEditTitle(event.title);
    setEditDescription(event.description);
    setEditDate(d.toISOString().split('T')[0]);
    setEditTime(d.toTimeString().slice(0, 5));
    if (event.endDate) {
      const ed = new Date(event.endDate);
      setEditEndDate(ed.toISOString().split('T')[0]);
      setEditEndTime(ed.toTimeString().slice(0, 5));
    } else {
      setEditEndDate('');
      setEditEndTime('');
    }
    setEditVenue(event.venue);
    setEditOrganizer(event.organizer);
    setEditCategory(event.category);
    setEditRegistrationLink(event.registrationLink || '');
    setEditWebsiteLink(event.websiteLink || '');
    setEditInstagramLink(event.instagramLink || '');
    setEditLinkedinLink(event.linkedinLink || '');
    setEditContactEmail(event.contactEmail || '');
    setEditContactPhone(event.contactPhone || '');
    setEditEntryFee(event.entryFee || '');
    setEditTeamSize(event.teamSize || '');
    setEditCustomFields(event.customFields ? [...event.customFields] : []);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const eventTimestamp = new Date(`${editDate}T${editTime}`).getTime();
      const endTimestamp = editEndDate && editEndTime ? new Date(`${editEndDate}T${editEndTime}`).getTime() : undefined;

      const data: Partial<Event> = {
        title: editTitle,
        description: editDescription,
        date: eventTimestamp,
        venue: editVenue,
        organizer: editOrganizer,
        category: editCategory,
        registrationLink: editRegistrationLink || undefined,
        websiteLink: editWebsiteLink || undefined,
        instagramLink: editInstagramLink || undefined,
        linkedinLink: editLinkedinLink || undefined,
        contactEmail: editContactEmail || undefined,
        contactPhone: editContactPhone || undefined,
        entryFee: editEntryFee || undefined,
        teamSize: editTeamSize || undefined,
        endDate: endTimestamp || undefined,
        customFields: editCustomFields.filter(f => f.label && f.value),
      };

      const updates: Record<string, any> = {};
      
      if (event.status === 'approved') {
        // For already approved events, save changes into pendingUpdate
        updates.pendingUpdate = data;
        updates.status = 'pending'; // Go back to pending for review
      } else {
        // For new/rejected events, update directly
        Object.assign(updates, data);
        updates.status = 'pending';
        updates.pendingUpdate = null; // Clear any old pending update
      }

      await updateDoc(doc(db, 'events', event.id), updates);
      toast.success(event.status === 'approved' ? 'Changes submitted for review!' : 'Event re-submitted for approval.');
      setIsEditing(false);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    setEditCustomFields([...editCustomFields, { label: '', value: '' }]);
  };

  const removeCustomField = (index: number) => {
    setEditCustomFields(editCustomFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, key: 'label' | 'value', val: string) => {
    const updated = [...editCustomFields];
    updated[index][key] = val;
    setEditCustomFields(updated);
  };

  const linkItems = [
    { url: event.registrationLink, label: 'Register', icon: ExternalLink, color: 'text-primary' },
    { url: event.websiteLink, label: 'Website', icon: Globe, color: 'text-accent' },
    { url: event.instagramLink, label: 'Instagram', icon: InstagramIcon, color: 'text-pink-500' },
    { url: event.linkedinLink, label: 'LinkedIn', icon: LinkedinIcon, color: 'text-blue-600' },
  ].filter(l => l.url);

  // --- EDIT MODE ---
  if (isEditing) {
    return (
      <Modal isOpen={isOpen} onClose={() => setIsEditing(false)} title="Edit Event">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-xs text-warning">Saving changes will re-submit this event for Super Admin approval.</p>
          </div>

          <Input label="Event Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/80">Description</label>
            <textarea className="flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[80px]" value={editDescription} onChange={e => setEditDescription(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required />
            <Input label="Start Time" type="time" value={editTime} onChange={e => setEditTime(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="End Date" type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} required />
            <Input label="End Time" type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Venue" value={editVenue} onChange={e => setEditVenue(e.target.value)} required />
            <Input label="Organizer" value={editOrganizer} onChange={e => setEditOrganizer(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground/80">Category</label>
              <select className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                <option value="academic">Academic</option>
                <option value="club">Club / Society</option>
                <option value="sports">Sports</option>
                <option value="cultural">Cultural</option>
                <option value="workshop">Workshop</option>
                <option value="hackathon">Hackathon</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Input label="Entry Fee" value={editEntryFee} onChange={e => setEditEntryFee(e.target.value)} placeholder="Free, ₹200" required />
          </div>
          <Input label="Team Size" value={editTeamSize} onChange={e => setEditTeamSize(e.target.value)} placeholder="Solo, 2-4 members" required />

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold mb-3 text-foreground/70">Links & Support</p>
            <div className="space-y-3">
              <Input label="Registration Link" value={editRegistrationLink} onChange={e => setEditRegistrationLink(e.target.value)} required />
              <Input label="Website" value={editWebsiteLink} onChange={e => setEditWebsiteLink(e.target.value)} required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Instagram (optional)" value={editInstagramLink} onChange={e => setEditInstagramLink(e.target.value)} />
                <Input label="LinkedIn (optional)" value={editLinkedinLink} onChange={e => setEditLinkedinLink(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold mb-3 text-foreground/70">Contact Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" value={editContactEmail} onChange={e => setEditContactEmail(e.target.value)} required />
              <Input label="Phone" value={editContactPhone} onChange={e => setEditContactPhone(e.target.value)} required />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground/70">Custom Fields</p>
              <button type="button" onClick={addCustomField} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Field
              </button>
            </div>
            {editCustomFields.map((field, index) => (
              <div key={index} className="flex items-end gap-2 mb-2">
                <div className="flex-1"><Input label="Label" value={field.label} onChange={e => updateCustomField(index, 'label', e.target.value)} /></div>
                <div className="flex-1"><Input label="Value" value={field.value} onChange={e => updateCustomField(index, 'value', e.target.value)} /></div>
                <button type="button" onClick={() => removeCustomField(index)} className="h-10 w-10 flex items-center justify-center text-danger hover:bg-danger/10 rounded-lg shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save & Resubmit'}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- VIEW MODE ---
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event.title}>
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Category & Organizer */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-accent/10 text-accent">{event.category}</span>
          <span className="text-xs text-foreground/50">Organized by <strong className="text-foreground/80">{event.organizer}</strong></span>
          {event.status === 'pending' && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-warning/10 text-warning">Pending Approval</span>}
          {event.status === 'rejected' && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-danger/10 text-danger">Rejected</span>}
        </div>

        {/* Moderator Remarks */}
        {event.moderatorRemarks && (event.status === 'pending' || event.status === 'rejected') && (
          <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-warning uppercase tracking-wider mb-1">Moderator Feedback</p>
              <p className="text-sm text-foreground/80 italic">"{event.moderatorRemarks}"</p>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{event.description}</p>
        </div>

        {/* Date, Time, Venue */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-tighter text-foreground/40">Date</p>
              <p className="text-xs font-semibold">{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-tighter text-foreground/40">Time</p>
              <p className="text-xs font-semibold">
                {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {event.endDate && ` – ${new Date(event.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-tighter text-foreground/40">Venue</p>
              <p className="text-xs font-semibold truncate">{event.venue}</p>
          </div>
        </div>
      </div>

        {/* Entry Fee & Team Size */}
        {(event.entryFee || event.teamSize) && (
          <div className="grid grid-cols-2 gap-3">
            {event.entryFee && (
              <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 shadow-sm">
                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-foreground/40">Entry Fee</p>
                  <p className="text-xs font-semibold">{event.entryFee}</p>
                </div>
              </div>
            )}
            {event.teamSize && (
              <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 shadow-sm">
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Users2 className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-tighter text-foreground/40">Team Size</p>
                  <p className="text-xs font-semibold">{event.teamSize}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Links */}
        {linkItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2 px-1">Links</p>
            <div className="flex flex-wrap gap-2">
              {linkItems.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all ${link.color}`}>
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {(event.contactEmail || event.contactPhone) && (
          <div className="bg-muted/20 rounded-xl p-4 border border-border/50">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 px-1">Contact for queries</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {event.contactEmail && (
                <a href={`mailto:${event.contactEmail}`} className="flex items-center gap-2.5 text-sm font-medium text-foreground/70 hover:text-primary transition-colors bg-card/50 p-2 rounded-lg border border-border/40">
                  <Mail className="h-4 w-4" /> {event.contactEmail}
                </a>
              )}
              {event.contactPhone && (
                <a href={`tel:${event.contactPhone}`} className="flex items-center gap-2.5 text-sm font-medium text-foreground/70 hover:text-primary transition-colors bg-card/50 p-2 rounded-lg border border-border/40">
                  <Phone className="h-4 w-4" /> {event.contactPhone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {event.customFields && event.customFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2 px-1">Additional Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {event.customFields.map((field, i) => (
                <div key={i} className="flex flex-col bg-card border border-border rounded-xl px-3 py-2 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-foreground/40">{field.label}</span>
                  <span className="text-sm font-semibold">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4 border-t border-border">
          {/* Super Admin Moderation Actions */}
          {isSuperAdmin && isAdminView && (
            <div className="flex flex-col gap-3 bg-muted/20 p-4 rounded-xl border border-border">
              <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">Moderation Panel</p>
              <textarea
                placeholder="Add remarks/reason for this action (notified to creator)..."
                className="flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[80px]"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <div className="flex gap-3">
                {event.status === 'pending' && onApprove && (
                  <Button 
                    className="flex-1 bg-success hover:bg-success/90 text-white font-bold" 
                    onClick={() => { onApprove?.(event.id, remarks); onClose(); }}
                  >
                    Approve
                  </Button>
                )}
                {event.status === 'pending' && onReject && (
                  <Button 
                    variant="outline" 
                    className="flex-1 border-danger text-danger hover:bg-danger/10 font-bold" 
                    onClick={() => { onReject?.(event.id, remarks); onClose(); }}
                  >
                    Reject
                  </Button>
                )}
                {onDelete && (
                  <Button 
                    variant="outline" 
                    className="flex-1 border-danger text-danger hover:bg-danger/10 font-bold flex items-center justify-center gap-2" 
                    onClick={() => { onDelete(event.id, remarks); onClose(); }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Regular User Actions */}
          <div className="flex items-center gap-3">
            
            {isCreator && !isAdminView && onDelete && (
              <Button 
                variant="ghost" 
                className="h-11 flex items-center gap-2 font-semibold hover:bg-danger/10 text-danger" 
                onClick={() => { onDelete(event.id, ""); onClose(); }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}

            <Button
              variant="ghost"
              className="h-11 flex items-center gap-2 font-semibold hover:bg-primary/5 text-foreground/70"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: event.title,
                    text: `Check out ${event.title}!`,
                    url: window.location.href
                  });
                } else {
                  const text = `Check out this event: ${event.title}\n📅 ${new Date(event.date).toLocaleDateString()}\n📍 ${event.venue}\nOrganized by ${event.organizer}\n\nJoin the community to see more details!`;
                  navigator.clipboard.writeText(text);
                  toast.success('Event info copied to clipboard!');
                }
              }}
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
            {isCreator && (
              <Button variant="ghost" className="h-11 flex items-center gap-2 font-semibold hover:bg-primary/5 text-primary" onClick={startEditing}>
                <Edit2 className="h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
