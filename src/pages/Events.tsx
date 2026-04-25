import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event, EventParticipation } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Calendar, Clock, MapPin, Users, Plus, ExternalLink, Globe } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { EventModal } from '../components/EventModal';
import { EventDetailModal } from '../components/EventDetailModal';

export default function Events() {
  const { userData, currentUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<Record<string, string>>({}); // eventId -> participationId
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (!userData?.classId || !currentUser) return;

    // Listen to Global Approved Events
    const eventsQuery = query(collection(db, 'events'), where('status', '==', 'approved'));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      fetchedEvents.sort((a, b) => a.date - b.date); // Sort by date ascending
      setEvents(fetchedEvents);
      setLoading(false);
    });

    // Listen to current user's participations
    const participationsQuery = query(
      collection(db, 'event_participations'),
      where('userId', '==', currentUser.uid)
    );
    const unsubscribeParticipations = onSnapshot(participationsQuery, (snapshot) => {
      const parts: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as EventParticipation;
        if (data.status === 'going') {
          parts[data.eventId] = doc.id;
        }
      });
      setParticipations(parts);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeParticipations();
    };
  }, [userData, currentUser]);

  const toggleParticipation = async (event: Event) => {
    if (!currentUser) return;
    
    const isGoing = !!participations[event.id];
    const participationId = participations[event.id];
    
    try {
      const batch = writeBatch(db);
      const eventRef = doc(db, 'events', event.id);
      
      if (isGoing && participationId) {
        // User wants to cancel
        const partRef = doc(db, 'event_participations', participationId);
        batch.delete(partRef);
        batch.update(eventRef, {
          goingCount: Math.max(0, event.goingCount - 1)
        });
        toast.success("You are no longer going to this event");
      } else {
        // User wants to go
        const newPartRef = doc(collection(db, 'event_participations'));
        batch.set(newPartRef, {
          userId: currentUser.uid,
          eventId: event.id,
          status: 'going'
        });
        batch.update(eventRef, {
          goingCount: event.goingCount + 1
        });
        toast.success("Awesome! You're going!");
      }

      await batch.commit();
    } catch (error) {
      toast.error('Failed to update participation');
      console.error(error);
    }
  };

  const handleDeleteEvent = async (eventId: string, remarks: string = "") => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    
    try {
      const eventDoc = events.find(e => e.id === eventId) || (selectedEvent?.id === eventId ? selectedEvent : null);
      if (!eventDoc) return;

      // Notify the creator if a Super Admin deleted it (and it's not the creator themselves)
      if (userData?.isSuperAdmin && eventDoc.createdBy !== currentUser?.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: eventDoc.createdBy,
          title: `Event Deleted: ${eventDoc.title}`,
          message: `Your event "${eventDoc.title}" has been deleted by a Super Admin.`,
          remarks: remarks || "No specific reason provided.",
          type: 'event_deletion',
          createdAt: Date.now(),
          read: false
        });
      }

      await deleteDoc(doc(db, 'events', eventId));
      toast.success('Event deleted successfully');
      setEvents(prev => prev.filter(e => e.id !== eventId));
      setSelectedEvent(null);
    } catch (error) {
      toast.error('Failed to delete event');
      console.error(error);
    }
  };

  const now = Date.now();
  const upcomingEvents = events.filter(e => e.date >= now - 24 * 60 * 60 * 1000); // include today's events
  const pastEvents = events.filter(e => e.date < now - 24 * 60 * 60 * 1000);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-12 w-48 bg-card rounded-lg mb-6"></div>
      <div className="h-40 bg-card rounded-xl"></div>
      <div className="h-40 bg-card rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Events</h1>
          <p className="text-foreground/60">Discover and participate in platform-wide events</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Suggest Event
        </Button>
      </div>

      <div className="space-y-4 max-w-4xl">
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <Calendar className="h-12 w-12 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No upcoming events</h3>
            <p className="text-foreground/60 mt-1">Be the first to organize something for your class!</p>
          </div>
        ) : (
          upcomingEvents.map(event => {
            const isGoing = !!participations[event.id];
            
            return (
              <Card key={event.id} className="overflow-hidden border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setSelectedEvent(event)}>
                <CardContent className="p-0 sm:flex">
                  {/* Date Block */}
                  <div className="bg-primary/5 p-6 flex flex-col items-center justify-center sm:w-32 sm:border-r border-b sm:border-b-0 border-border">
                    <span className="text-sm font-bold text-primary uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-3xl font-black">{new Date(event.date).getDate()}</span>
                  </div>
                  
                  {/* Content Block */}
                  <div className="p-6 flex-1">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-accent/10 text-accent">
                            {event.category}
                          </span>
                          <span className="text-xs text-foreground/50">By {event.organizer}</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2">{event.title}</h2>
                        <p className="text-sm text-foreground/70 mb-4 whitespace-pre-wrap">{event.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-foreground/60 mb-4">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            <span>{event.venue}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-primary font-medium">
                            <Users className="h-4 w-4" />
                            <span>{event.goingCount || 0} going</span>
                          </div>
                        </div>
                        {/* Link indicators */}
                        {(event.registrationLink || event.websiteLink) && (
                          <div className="flex items-center gap-2 mt-1">
                            {event.registrationLink && <span className="flex items-center gap-1 text-xs text-primary"><ExternalLink className="h-3 w-3" /> Register</span>}
                            {event.websiteLink && <span className="flex items-center gap-1 text-xs text-accent"><Globe className="h-3 w-3" /> Website</span>}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center md:items-end flex-col justify-between">
                        <Button 
                          variant={isGoing ? "secondary" : "primary"} 
                          className={`w-full md:w-32 ${isGoing ? 'bg-primary/20 hover:bg-danger/20 hover:text-danger text-primary' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleParticipation(event); }}
                        >
                          {isGoing ? 'Cancel' : 'I am Going'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {pastEvents.length > 0 && (
        <div className="pt-8 max-w-4xl">
          <h3 className="text-lg font-semibold mb-4 text-foreground/60">Past Events</h3>
          <div className="space-y-4 opacity-60">
            {pastEvents.map(event => (
              <Card key={event.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center w-12">
                      <span className="text-xs font-bold text-foreground/60 block">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-lg font-bold">{new Date(event.date).getDate()}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{event.title}</h4>
                      <p className="text-xs text-foreground/60">{event.venue}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-foreground/10 px-2.5 py-1 rounded-full">
                    {event.goingCount || 0} attended
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <EventDetailModal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        isGoing={selectedEvent ? !!participations[selectedEvent.id] : false}
        onToggleParticipation={(ev) => { toggleParticipation(ev); setSelectedEvent(null); }}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
