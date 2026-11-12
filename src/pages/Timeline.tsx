import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task, Event, EventParticipation } from '../types';
import { TaskModal } from '../components/TaskModal';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Plus, Clock, Calendar, AlertTriangle, MapPin, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Card } from '../components/ui/Card';

type TimelineItem = 
  | { type: 'task'; data: Task; timestamp: number }
  | { type: 'event'; data: Event; timestamp: number };

export default function Timeline() {
  const navigate = useNavigate();
  const { userData, currentUser } = useAuth();
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTimer, setRefreshTimer] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTimeline = async (force = false) => {
    if (!userData?.classId || !currentUser || (refreshTimer > 0 && !force)) return;
    
    setIsRefreshing(true);
    if (!force) setLoading(true);

    try {
      const [tasksSnap, eventsSnap, partsSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('classId', '==', userData.classId))),
        getDocs(query(collection(db, 'events'), where('status', '==', 'approved'))),
        getDocs(query(collection(db, 'event_participations'), where('userId', '==', currentUser.uid)))
      ]);

      const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      const events = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      const goingEventIds = partsSnap.docs
        .map(doc => doc.data() as EventParticipation)
        .filter(p => p.status === 'going')
        .map(p => p.eventId);

      const merged: TimelineItem[] = [
        ...tasks.map(t => ({ type: 'task' as const, data: t, timestamp: t.deadline })),
        ...events
          .filter(e => goingEventIds.includes(e.id))
          .map(e => ({ type: 'event' as const, data: e, timestamp: e.date }))
      ];
      
      merged.sort((a, b) => a.timestamp - b.timestamp);
      setTimelineItems(merged);
      setRefreshTimer(10);
    } catch (error) {
      console.error(error);
      toast.error('Sync failed');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleToggleDone = async (taskId: string, isDone: boolean) => {
    if (!currentUser) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        completedBy: isDone ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });
      fetchTimeline(true);
      if (!isDone) toast.success('Marked as done', { position: 'bottom-right' });
    } catch (error) {
      toast.error('Sync failed');
    }
  };

  useEffect(() => {
    fetchTimeline();

    const handleGlobalRefresh = () => fetchTimeline(true);
    window.addEventListener('app-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('app-refresh', handleGlobalRefresh);
  }, [userData, currentUser]);

  useEffect(() => {
    if (refreshTimer > 0) {
      const interval = setInterval(() => setRefreshTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [refreshTimer]);

  const now = Date.now();

  const isPast = (timestamp: number) => timestamp < now;
  const isCritical = (timestamp: number, priority?: string) => !isPast(timestamp) && (timestamp <= now + 48 * 60 * 60 * 1000 || priority === 'critical');

  if (loading) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Deadlines and events"
        title="Timeline"
        description="Tasks and the events you're going to, in time order."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/profile')}>
              Window {userData?.deadlinePreference || 2}D
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" /> Add task
            </Button>
          </>
        }
      />

      <div className="relative ml-4 pb-8 sm:ml-6">
        <div className="absolute bottom-0 left-0 top-4 w-px bg-gradient-to-b from-primary via-accent/60 to-transparent opacity-40" />

        {timelineItems.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nothing scheduled"
            description="Tasks and events you join will show up here."
            className="ml-6"
          />
        ) : (
          <div className="space-y-12">
            {timelineItems.map((item) => {
              const past = isPast(item.timestamp);
              const key = item.type === 'task' ? `task-${item.data.id}` : `event-${item.data.id}`;
              const itemDate = new Date(item.timestamp);
                           if (item.type === 'task') {
                const task = item.data;
                const isDone = task.completedBy?.includes(currentUser?.uid || '');
                const isMissed = !isDone && past;
                const critical = isCritical(task.deadline, task.priority) && !isDone;
                
                return (
                  <div key={key} className={`relative pl-8 sm:pl-12 group transition-all duration-500 ${isDone ? 'opacity-40' : isMissed ? 'opacity-80' : ''}`}>
                    {/* Simple Node for Past Tasks */}
                    <div className={`absolute -left-[10px] sm:-left-[14px] top-6 h-5 w-5 sm:h-7 sm:w-7 rounded-full border-[3px] sm:border-4 border-background flex items-center justify-center shadow-xl z-10 transition-transform group-hover:scale-125 ${
                      isDone ? 'bg-success' : isMissed ? 'bg-foreground/20' : critical ? 'bg-danger animate-pulse shadow-danger/50' : 'bg-primary shadow-primary/50'
                    }`}>
                      {isDone ? <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-white" /> : <div className="h-1 w-1 sm:h-1.5 sm:w-1.5 bg-white rounded-full" />}
                    </div>

                    <Card className={`overflow-hidden transition-all duration-500  hover:shadow-2xl ${
                      isDone ? 'border-success/30 bg-success/5' : isMissed ? 'border-border bg-muted' : critical ? 'border-danger/30 bg-danger/5' : 'bg-card/20  border-border'
                    }`}>
                      <div className="p-5 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-8">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 text-xs font-medium rounded-lg  ${
                              isDone ? 'bg-success text-white' :
                              task.priority === 'critical' ? 'bg-danger text-white' :
                              task.priority === 'medium' ? 'bg-accent/20 text-accent' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {isDone ? 'Done' : `${task.priority} Priority`}
                            </span>
                            {critical && !past && (
                              <div className="flex items-center gap-1.5 text-danger animate-pulse">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-medium">Due soon</span>
                              </div>
                            )}
                          </div>
                          
                          <h3 className={`text-xl sm:text-3xl font-semibold tracking-tight leading-tight transition-colors ${isDone ? 'text-success line-through opacity-50' : 'group-hover:text-primary'}`}>
                            {task.title}
                          </h3>
                          
                          {task.description && (
                            <p className="text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2">{task.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 sm:gap-6">
                          <div className="shrink-0 flex flex-col gap-2 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-muted border border-border min-w-[140px] sm:min-w-[180px]">
                             <div className="flex items-center justify-between">
                                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-20" />
                                <span className="text-xs sm:text-xs font-medium">{itemDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
                             </div>
                             <div className="flex items-center justify-between">
                                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-20" />
                                <span className="text-base sm:text-xl font-semibold">{itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                          </div>

                          <Button 
                            variant="ghost" 
                            className={`h-11 w-11 sm:h-14 sm:w-14 p-0 rounded-xl sm:rounded-2xl border border-border shrink-0 ${isDone ? 'text-success bg-success/10' : 'text-muted-foreground hover:text-primary'}`}
                            onClick={() => handleToggleDone(task.id, !!isDone)}
                          >
                            {isDone ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <Circle className="h-5 w-5 sm:h-6 sm:w-6" />}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              } else {
                const event = item.data;
                return (
                  <div key={key} className={`relative pl-8 sm:pl-12 group transition-all duration-500 ${past ? 'opacity-30 grayscale' : ''}`}>
                    <div className={`absolute -left-[10px] sm:-left-[14px] top-6 h-5 w-5 sm:h-7 sm:w-7 rounded-full border-[3px] sm:border-4 border-background flex items-center justify-center shadow-xl z-10 transition-transform group-hover:scale-125 ${
                      past ? 'bg-foreground/20' : 'bg-accent shadow-accent/50'
                    }`}>
                       <div className="h-1 w-1 sm:h-1.5 sm:w-1.5 bg-white rounded-full" />
                    </div>

                    <Card className="bg-accent/5 border border-accent/20 overflow-hidden hover:border-accent/40 transition-all hover:shadow-2xl">
                       <div className="p-5 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-8">
                          <div className="space-y-4 flex-1">
                             <div className="flex items-center gap-3">
                                <span className="px-3 py-1 text-xs font-medium rounded-lg bg-accent/20 text-accent">
                                   {event.category} Event
                                </span>
                             </div>
                             
                             <h3 className="text-xl sm:text-3xl font-semibold tracking-tight leading-tight group-hover:text-accent transition-colors">
                                {event.title}
                             </h3>
                             
                             <div className="flex items-center gap-2 opacity-40">
                                <MapPin className="h-4 w-4" />
                                <span className="text-xs font-bold tracking-normal">{event.venue}</span>
                             </div>
                          </div>

                          <div className="shrink-0 flex flex-col gap-2 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-accent/10 border border-accent/10 min-w-[140px] sm:min-w-[180px]">
                             <div className="flex items-center justify-between text-accent">
                                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-40" />
                                <span className="text-xs sm:text-xs font-medium">{itemDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
                             </div>
                             <div className="flex items-center justify-between text-accent">
                                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-40" />
                                <span className="text-base sm:text-xl font-semibold">{itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                          </div>
                       </div>
                    </Card>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
