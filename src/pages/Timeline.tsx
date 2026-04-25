import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task, Event, EventParticipation } from '../types';
import { TaskModal } from '../components/TaskModal';
import { Button } from '../components/ui/Button';
import { Plus, Clock, Calendar, AlertTriangle, PartyPopper } from 'lucide-react';

type TimelineItem = 
  | { type: 'task'; data: Task; timestamp: number }
  | { type: 'event'; data: Event; timestamp: number };

export default function Timeline() {
  const { userData, currentUser } = useAuth();
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!userData?.classId || !currentUser) return;

    let tasksData: Task[] = [];
    let eventsData: Event[] = [];
    let participationsData: string[] = []; // Array of eventIds the user is going to

    const mergeAndSetItems = () => {
      const merged: TimelineItem[] = [
        ...tasksData.map(t => ({ type: 'task' as const, data: t, timestamp: t.deadline })),
        ...eventsData
          .filter(e => participationsData.includes(e.id))
          .map(e => ({ type: 'event' as const, data: e, timestamp: e.date }))
      ];
      merged.sort((a, b) => a.timestamp - b.timestamp);
      setTimelineItems(merged);
      setLoading(false);
    };

    const tasksQuery = query(collection(db, 'tasks'), where('classId', '==', userData.classId));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      mergeAndSetItems();
    });

    const eventsQuery = query(collection(db, 'events'), where('status', '==', 'approved'));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      mergeAndSetItems();
    });

    const partsQuery = query(collection(db, 'event_participations'), where('userId', '==', currentUser.uid));
    const unsubscribeParts = onSnapshot(partsQuery, (snapshot) => {
      participationsData = snapshot.docs
        .map(doc => doc.data() as EventParticipation)
        .filter(p => p.status === 'going')
        .map(p => p.eventId);
      mergeAndSetItems();
    });

    return () => {
      unsubscribeTasks();
      unsubscribeEvents();
      unsubscribeParts();
    };
  }, [userData, currentUser]);

  const now = Date.now();

  const isPast = (timestamp: number) => timestamp < now;
  const isCritical = (timestamp: number, priority?: string) => !isPast(timestamp) && (timestamp <= now + 48 * 60 * 60 * 1000 || priority === 'critical');

  if (loading) {
    return <div className="animate-pulse h-64 bg-card rounded-xl"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
          <p className="text-foreground/60">Your unified schedule for tasks and events.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Task
        </Button>
      </div>

      <div className="relative border-l-2 border-border/50 pl-6 space-y-8 mt-8 ml-4">
        {timelineItems.length === 0 ? (
          <p className="text-foreground/50">Your timeline is clear!</p>
        ) : (
          timelineItems.map((item) => {
            const past = isPast(item.timestamp);
            const key = item.type === 'task' ? `task-${item.data.id}` : `event-${item.data.id}`;
            
            if (item.type === 'task') {
              const task = item.data;
              const critical = isCritical(task.deadline, task.priority);
              
              return (
                <div key={key} className={`relative ${past ? 'opacity-50' : ''}`}>
                  <div className={`absolute -left-[33px] flex h-4 w-4 items-center justify-center rounded-full border-4 border-background ${
                    past ? 'bg-border' : critical ? 'bg-danger' : 'bg-primary'
                  }`} />
                  <div className={`rounded-xl border p-5 shadow-sm transition-all ${
                    critical && !past ? 'border-danger/30 bg-danger/5' : 'border-border bg-card'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${
                            task.priority === 'critical' ? 'bg-danger/20 text-danger' :
                            task.priority === 'medium' ? 'bg-accent/20 text-accent' :
                            'bg-foreground/10 text-foreground/70'
                          }`}>
                            {task.priority} Task
                          </span>
                          {critical && !past && (
                            <span className="flex items-center text-xs font-bold text-danger">
                              <AlertTriangle className="h-3 w-3 mr-1" /> URGENT
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold leading-tight">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-foreground/70 mt-2 whitespace-pre-wrap">{task.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-foreground/60 shrink-0 bg-background/50 px-3 py-2 rounded-lg border border-border/50">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(task.deadline).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          <span>{new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else {
              const event = item.data;
              return (
                <div key={key} className={`relative ${past ? 'opacity-50' : ''}`}>
                  <div className={`absolute -left-[33px] flex h-4 w-4 items-center justify-center rounded-full border-4 border-background ${
                    past ? 'bg-border' : 'bg-accent'
                  }`} />
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 shadow-sm transition-all hover:border-accent/50">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full bg-accent/20 text-accent flex items-center">
                            <PartyPopper className="h-3 w-3 mr-1" /> {event.category} Event
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold leading-tight">{event.title}</h3>
                        <p className="text-sm text-foreground/70 mt-1">{event.venue}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-foreground/60 shrink-0 bg-background/50 px-3 py-2 rounded-lg border border-accent/20">
                        <div className="flex items-center gap-1.5 text-accent">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">{new Date(event.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-accent">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
