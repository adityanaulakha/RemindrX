import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs, deleteDoc, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event, EventParticipation } from '../types';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import {
  Calendar, Clock, MapPin, Plus, Globe, Search, Sparkles, ArrowRight, Radio
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { EventModal } from '../components/EventModal';
import { EventDetailModal } from '../components/EventDetailModal';

const CATEGORIES = ['All', 'Academic', 'Club', 'Sports', 'Cultural', 'Workshop', 'Hackathon', 'Other'];

export default function Events() {
  const { userData, currentUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // Filtering
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEvents = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'events'), 
        where('status', '==', 'approved'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const fetchedEvents = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Event))
        .sort((a, b) => a.date - b.date);
      
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    if (!currentUser) return;
    const participationsQuery = query(
      collection(db, 'event_participations'),
      where('userId', '==', currentUser.uid)
    );
    const unsubscribeParticipations = onSnapshot(participationsQuery, (snapshot) => {
      const parts: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as EventParticipation;
        if (data.status === 'going') parts[data.eventId] = doc.id;
      });
      setParticipations(parts);
    });

    return () => unsubscribeParticipations();
  }, [currentUser]);

  const handleDeleteEvent = async (eventId: string, remarks: string = "") => {
    if (!window.confirm('Delete this event?')) return;
    try {
      const eventDoc = events.find(e => e.id === eventId) || (selectedEvent?.id === eventId ? selectedEvent : null);
      if (!eventDoc) return;

      if (userData?.isSuperAdmin && eventDoc.createdBy !== currentUser?.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: eventDoc.createdBy,
          title: `Event removed: ${eventDoc.title}`,
          message: `Your event "${eventDoc.title}" was removed by a super admin.`,
          remarks: remarks || "Removed by an administrator.",
          type: 'event_deletion',
          createdAt: Date.now(),
          read: false
        });
      }
      await deleteDoc(doc(db, 'events', eventId));
      toast.success('Event deleted');
      setEvents(prev => prev.filter(e => e.id !== eventId));
      setSelectedEvent(null);
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const now = Date.now();
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchesCategory = activeCategory === 'All' || e.category?.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           e.organizer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [events, activeCategory, searchQuery]);

  const upcomingEvents = filteredEvents.filter(e => e.date >= now - 24 * 60 * 60 * 1000);
  const featuredEvent = upcomingEvents[0];

  if (loading) return <PageSkeleton rows={6} />;

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow="Campus"
        title="Events"
        description="Workshops, clubs, and other campus events."
        actions={
          <>
            <Badge tone="success" className="h-10 px-3"><Radio className="h-3.5 w-3.5" /> {events.length} listed</Badge>
            <Button onClick={() => setIsModalOpen(true)}><Plus className="h-4 w-4" /> Add event</Button>
          </>
        }
      />

      {featuredEvent && (
        <Card
          interactive
          elevated
          className="cursor-pointer overflow-hidden p-6 sm:p-8"
          onClick={() => setSelectedEvent(featuredEvent)}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Next up
              </p>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">{featuredEvent.title}</h2>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />{new Date(featuredEvent.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />{featuredEvent.venue}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">View details <ArrowRight className="h-3.5 w-3.5" /></span>
          </div>
        </Card>
      )}

      <div className="sticky top-4 z-30 flex flex-col items-stretch gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-[var(--shadow)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-[0_0_24px_-10px_var(--glow)]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events"
            className="control h-11 pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {upcomingEvents.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No matching events"
            description="Nothing matches this search."
            className="col-span-full"
          />
        ) : (
          upcomingEvents.map(event => {
            const eventDate = new Date(event.date);
            return (
              <Card
                key={event.id}
                interactive
                className="group cursor-pointer p-5"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-lg font-semibold text-primary">
                    {eventDate.getDate()}
                  </div>
                  <Badge>{eventDate.toLocaleString('default', { month: 'short' })}</Badge>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone="primary">{event.category}</Badge>
                  <span className="text-xs text-muted-foreground">{event.organizer}</span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary">{event.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{event.description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="inline-flex max-w-[55%] items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 text-primary" />{event.venue}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-accent" />{eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <EventDetailModal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        isGoing={selectedEvent ? !!participations[selectedEvent.id] : false}
        onToggleParticipation={() => { setSelectedEvent(null); }}
        onDelete={handleDeleteEvent}
        isAdminView={false}
      />
    </div>
  );
}
