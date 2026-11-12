import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs, deleteDoc, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event, EventParticipation } from '../types';
import { Button } from '../components/ui/Button';
import { 
  Calendar, Clock, MapPin, Users, Plus, ExternalLink, Globe, 
  RefreshCw, Activity, Zap, ShieldCheck, Search, Filter, 
  Sparkles, ArrowRight, Radio
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-12">
        <div className="h-[400px] bg-card/20 rounded-3xl border border-border"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-96 bg-card/20 rounded-3xl border border-border"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20">
      {/* Featured Header / Hero */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="relative overflow-hidden rounded-3xl bg-card/60 border border-border shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-stretch min-h-[450px]">
             {/* Left Info */}
             <div className="flex-1 p-10 lg:p-16 flex flex-col justify-center space-y-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-inner">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold tracking-normal text-primary">Campus</span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-foreground pr-8">
                    Events
                  </h1>
                  <p className="text-sm font-medium text-muted-foreground max-w-sm leading-relaxed">
                    Workshops, clubs, and other campus events.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button onClick={() => setIsModalOpen(true)} className="h-16 px-10 rounded-2xl font-medium shadow-2xl shadow-primary/20 group/btn">
                    <Plus className="mr-3 h-5 w-5 group-hover:rotate-90 transition-transform" /> Add event
                  </Button>
                  <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-muted border border-border">
                    <Radio className="h-4 w-4 text-success animate-pulse" />
                    <span className="text-xs font-medium text-success">{events.length} listed</span>
                  </div>
                </div>
             </div>

             {/* Right Featured Card (if exists) */}
             {featuredEvent && (
                <div className="hidden lg:flex w-1/3 bg-muted border-l border-border p-12 flex-col justify-center relative group/featured cursor-pointer" onClick={() => setSelectedEvent(featuredEvent)}>
                   <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover/featured:opacity-100 transition-opacity" />
                   <div className="relative space-y-6">
                      <p className="text-xs font-medium text-primary/60 flex items-center gap-2">
                        <Zap className="h-4 w-4 fill-primary" /> Next up
                      </p>
                      <h3 className="text-4xl font-semibold tracking-tight line-clamp-2 leading-tight">
                        {featuredEvent.title}
                      </h3>
                      <div className="space-y-3">
                         <div className="flex items-center gap-3 text-xs font-medium opacity-40">
                           <Calendar className="h-4 w-4 text-primary" /> 
                           {new Date(featuredEvent.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                         </div>
                         <div className="flex items-center gap-3 text-xs font-medium opacity-40">
                           <MapPin className="h-4 w-4 text-accent" /> {featuredEvent.venue}
                         </div>
                      </div>
                      <div className="pt-4 flex items-center gap-2 text-xs font-semibold text-primary group-hover/featured:gap-4 transition-all">
                        View Details <ArrowRight className="h-3 w-3" />
                      </div>
                   </div>
                </div>
             )}
          </div>
        </div>
      </div>

      {/* Discovery Toolbar */}
      <div className="sticky top-4 z-40 flex flex-col md:flex-row gap-6 items-center justify-between p-4 bg-card/40 border border-border rounded-2xl shadow-2xl">
         <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2 w-full md:w-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-3 rounded-2xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {cat}
              </button>
            ))}
         </div>
         
         <div className="relative w-full md:w-80 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 group-focus-within:opacity-100 transition-opacity" />
            <input 
              type="text" 
              placeholder="Search events"
              className="w-full h-14 pl-14 pr-6 bg-muted border border-border rounded-2xl text-xs font-bold tracking-normal outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
         </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {upcomingEvents.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center rounded-3xl bg-card/20 border border-dashed border-border text-center">
            <div className="p-10 bg-muted rounded-3xl mb-8 relative">
               <Activity className="h-16 w-16 opacity-10 animate-pulse" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <Globe className="h-8 w-8 text-primary opacity-20" />
               </div>
            </div>
            <h3 className="text-3xl font-semibold tracking-tight mb-2">No matching events</h3>
            <p className="text-xs text-muted-foreground font-semibold tracking-normal max-w-xs">
              Nothing matches this search.
            </p>
          </div>
        ) : (
          upcomingEvents.map(event => {
            const eventDate = new Date(event.date);
            
            return (
              <div 
                key={event.id} 
                className="group relative flex flex-col bg-card/40 border border-border rounded-3xl overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-sm cursor-pointer"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none transition-transform duration-1000">
                  <Radio className="h-32 w-32" />
                </div>

                <div className="p-10 flex flex-col h-full space-y-6">
                   <div className="flex justify-between items-start">
                      <div className="h-12 w-12 rounded-2xl bg-primary-soft flex items-center justify-center font-semibold text-lg text-primary shadow-inner">
                        {eventDate.getDate()}
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-muted border border-border text-xs font-medium opacity-40">
                         {eventDate.toLocaleString('default', { month: 'short' })}
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-lg">
                          {event.category}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {event.organizer}
                        </span>
                      </div>
                      <h3 className="text-2xl font-semibold tracking-tight leading-tight group-hover:text-primary transition-colors">
                        {event.title}
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground line-clamp-3 leading-relaxed">
                        {event.description}
                      </p>
                   </div>

                   <div className="pt-8 mt-auto border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <MapPin className="h-4 w-4 text-primary opacity-30" />
                         <span className="text-xs font-medium opacity-40 truncate max-w-[120px]">
                           {event.venue}
                         </span>
                      </div>
                      <div className="flex items-center gap-3">
                         <Clock className="h-4 w-4 text-accent opacity-30" />
                         <span className="text-xs font-medium opacity-40">
                           {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      </div>
                   </div>
                </div>
              </div>
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
