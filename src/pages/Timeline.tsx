import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task, Event, EventParticipation } from '../types';
import { TaskModal } from '../components/TaskModal';
import { Button } from '../components/ui/Button';
import { Plus, Clock, Calendar, AlertTriangle, PartyPopper, RefreshCw, MapPin, CheckCircle2, Circle } from 'lucide-react';
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

  if (loading) {
    return <div className="animate-pulse h-64 bg-card rounded-xl"></div>;
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
            Timeline
          </h1>
          <p className="text-sm font-medium text-foreground/40 max-w-xl">
            Integrated stream of tasks, assignments, and events.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            variant="ghost" 
            size="xl" 
            className="rounded-[2rem] px-8 font-black uppercase tracking-widest italic text-[10px] opacity-40 hover:opacity-100"
            onClick={() => navigate('/profile')}
          >
            Deadline Prefs: {userData?.deadlinePreference || 2}D
          </Button>
          <Button size="xl" className="rounded-[2rem] px-10 shadow-2xl shadow-primary/20 italic font-black uppercase tracking-widest" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-5 w-5" /> New Mission
          </Button>
        </div>
      </div>

      <div className="relative ml-4 md:ml-8 mt-12 pb-20">
        {/* Glowing Timeline Axis */}
        <div className="absolute left-0 top-4 bottom-0 w-1 bg-gradient-to-b from-primary via-accent to-transparent rounded-full shadow-[0_0_15px_rgba(var(--primary),0.3)] opacity-20" />

        {timelineItems.length === 0 ? (
          <div className="pl-12 py-24">
             <div className="h-20 w-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
               <Clock className="h-10 w-10 opacity-10" />
             </div>
             <h3 className="text-2xl font-black italic uppercase tracking-tighter opacity-40">Temporal Void</h3>
             <p className="text-xs font-bold uppercase tracking-widest opacity-20 mt-2">No upcoming objectives detected in the timeline.</p>
          </div>
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
                  <div key={key} className={`relative pl-12 group transition-all duration-500 ${isDone ? 'opacity-40' : isMissed ? 'opacity-80' : ''}`}>
                    {/* Simple Node for Past Tasks */}
                    <div className={`absolute -left-[14px] top-6 h-7 w-7 rounded-full border-4 border-background flex items-center justify-center shadow-xl z-10 transition-transform group-hover:scale-125 ${
                      isDone ? 'bg-success' : isMissed ? 'bg-foreground/20' : critical ? 'bg-danger animate-pulse shadow-danger/50' : 'bg-primary shadow-primary/50'
                    }`}>
                      {isDone ? <CheckCircle2 className="h-4 w-4 text-white" /> : <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                    </div>

                    <Card className={`overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${
                      isDone ? 'border-success/30 bg-success/5' : isMissed ? 'border-white/5 bg-white/5' : critical ? 'border-danger/30 bg-danger/5' : 'bg-card/20 backdrop-blur-xl border-white/10'
                    }`}>
                      <div className="p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg italic ${
                              isDone ? 'bg-success text-white' :
                              task.priority === 'critical' ? 'bg-danger text-white' :
                              task.priority === 'medium' ? 'bg-accent/20 text-accent' :
                              'bg-white/10 text-foreground/40'
                            }`}>
                              {isDone ? 'Goal Achieved' : `${task.priority} Priority`}
                            </span>
                            {critical && !past && (
                              <div className="flex items-center gap-1.5 text-danger animate-pulse">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Intercept Imminent</span>
                              </div>
                            )}
                          </div>
                          
                          <h3 className={`text-3xl font-black italic tracking-tighter uppercase leading-tight transition-colors ${isDone ? 'text-success line-through opacity-50' : 'group-hover:text-primary'}`}>
                            {task.title}
                          </h3>
                          
                          {task.description && (
                            <p className="text-sm text-foreground/40 font-medium leading-relaxed line-clamp-2">{task.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="shrink-0 flex flex-col gap-2 p-6 rounded-[2rem] bg-white/5 border border-white/5 min-w-[180px]">
                             <div className="flex items-center justify-between">
                                <Calendar className="h-4 w-4 opacity-20" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{itemDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
                             </div>
                             <div className="flex items-center justify-between">
                                <Clock className="h-4 w-4 opacity-20" />
                                <span className="text-xl font-black italic">{itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                          </div>

                          <Button 
                            variant="ghost" 
                            className={`h-14 w-14 p-0 rounded-2xl border border-white/10 ${isDone ? 'text-success bg-success/10' : 'text-foreground/40 hover:text-primary'}`}
                            onClick={() => handleToggleDone(task.id, !!isDone)}
                          >
                            {isDone ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              } else {
                const event = item.data;
                return (
                  <div key={key} className={`relative pl-12 group transition-all duration-500 ${past ? 'opacity-30 grayscale' : ''}`}>
                    <div className={`absolute -left-[14px] top-6 h-7 w-7 rounded-full border-4 border-background flex items-center justify-center shadow-xl z-10 transition-transform group-hover:scale-125 ${
                      past ? 'bg-foreground/20' : 'bg-accent shadow-accent/50'
                    }`}>
                       <div className="h-1.5 w-1.5 bg-white rounded-full" />
                    </div>

                    <Card className="bg-accent/5 backdrop-blur-xl border border-accent/20 overflow-hidden hover:border-accent/40 transition-all hover:-translate-y-1 hover:shadow-2xl">
                       <div className="p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                          <div className="space-y-4 flex-1">
                             <div className="flex items-center gap-3">
                                <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg bg-accent/20 text-accent italic">
                                   {event.category} Event
                                </span>
                             </div>
                             
                             <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-tight group-hover:text-accent transition-colors">
                                {event.title}
                             </h3>
                             
                             <div className="flex items-center gap-2 opacity-40">
                                <MapPin className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-widest italic">{event.venue}</span>
                             </div>
                          </div>

                          <div className="shrink-0 flex flex-col gap-2 p-6 rounded-[2rem] bg-accent/10 border border-accent/10 min-w-[180px]">
                             <div className="flex items-center justify-between text-accent">
                                <Calendar className="h-4 w-4 opacity-40" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{itemDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
                             </div>
                             <div className="flex items-center justify-between text-accent">
                                <Clock className="h-4 w-4 opacity-40" />
                                <span className="text-xl font-black italic">{itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
