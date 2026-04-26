import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task, Subject, Event, EventParticipation } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertTriangle, Calendar, BookOpen, PartyPopper, Activity, ArrowRight, PlusCircle, CheckCircle2, ShieldAlert, Clock, Circle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const isFirstTime = searchParams.get('firstTime') === 'true';
  const [showFTEModal, setShowFTEModal] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!userData?.classId) return;
      try {
        // Fetch Subjects
        const subQ = query(collection(db, 'subjects'), where('classId', '==', userData.classId), where('isActive', '==', true));
        const subSnap = await getDocs(subQ);
        const fetchedSubjects = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        setSubjects(fetchedSubjects);

        // Fetch Tasks
        const taskQ = query(collection(db, 'tasks'), where('classId', '==', userData.classId));
        const taskSnap = await getDocs(taskQ);
        const fetchedTasks = taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(fetchedTasks);

        // Fetch Global Approved Events
        const eventQ = query(collection(db, 'events'), where('status', '==', 'approved'));
        const eventSnap = await getDocs(eventQ);
        const fetchedEvents = eventSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
        setEvents(fetchedEvents);

        // Fetch User Participations
        if (currentUser) {
          const partQ = query(collection(db, 'event_participations'), where('userId', '==', currentUser.uid), where('status', '==', 'going'));
          const partSnap = await getDocs(partQ);
          const fetchedParts = partSnap.docs.map(doc => (doc.data() as EventParticipation).eventId);
          setParticipations(fetchedParts);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [userData]);

  useEffect(() => {
    if (!loading && isFirstTime) {
      setShowFTEModal(true);
    }
  }, [loading, isFirstTime]);

  const closeFTEModal = () => {
    setShowFTEModal(false);
    searchParams.delete('firstTime');
    setSearchParams(searchParams);
  };

  const handleToggleDone = async (taskId: string, isDone: boolean) => {
    if (!currentUser) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        completedBy: isDone ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });
      // Local update for immediate feedback
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        completedBy: isDone ? (t.completedBy || []).filter(id => id !== currentUser.uid) : [...(t.completedBy || []), currentUser.uid]
      } : t));
      if (!isDone) toast.success('Marked as done', { position: 'bottom-right' });
    } catch (error) {
      toast.error('Sync failed');
    }
  };

  const now = Date.now();
  const deadlineDays = userData?.deadlinePreference || 2;
  const deadlineTime = deadlineDays * 24 * 60 * 60 * 1000;

  // Filter Danger Zone Tasks (not completed and (within user preference window OR missed))
  const dangerZoneTasks = tasks.filter(t => {
    const isDone = t.completedBy?.includes(currentUser?.uid || '') || false;
    const isMissed = !isDone && t.deadline < now;
    const isUpcoming = !isDone && t.deadline > now && t.deadline <= now + deadlineTime;
    return isMissed || isUpcoming;
  });

  // Filter Upcoming Events (next 2 events that haven't passed and user is going)
  const dashboardEvents = events
    .filter(e => e.date > now && participations.includes(e.id))
    .sort((a, b) => a.date - b.date)
    .slice(0, 2);

  if (loading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-20 bg-card rounded-xl"></div>
      <div className="h-40 bg-card rounded-xl"></div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-64 bg-card rounded-xl"></div>
        <div className="h-64 bg-card rounded-xl"></div>
      </div>
    </div>;
  }

  // FIRST-TIME EXPERIENCE
  if (subjects.length === 0 && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-primary/10 p-6 rounded-full mb-6">
          <BookOpen className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Welcome back!</h1>
        <p className="text-foreground/60 max-w-md mx-auto mb-8 text-lg">
          You are the first one here or your class is brand new. Here is what you can do to get started:
        </p>
        
        <div className="grid gap-4 max-w-sm w-full">
          <div className="p-4 bg-card rounded-xl border border-border flex items-center gap-4 text-left shadow-sm">
            <div className="bg-primary/20 p-2 rounded-lg text-primary"><BookOpen className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-sm">0 Subjects Loaded</p>
              <p className="text-xs text-foreground/60">Ask your CR to add subjects.</p>
            </div>
          </div>
          <div className="p-4 bg-card rounded-xl border border-border flex items-center gap-4 text-left shadow-sm">
            <div className="bg-accent/20 p-2 rounded-lg text-accent"><Calendar className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-sm">0 Upcoming Deadlines</p>
              <p className="text-xs text-foreground/60">Use the + button to add tasks.</p>
            </div>
          </div>
          <div className="p-4 bg-card rounded-xl border border-border flex items-center gap-4 text-left shadow-sm">
            <div className="bg-danger/20 p-2 rounded-lg text-danger"><Activity className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-sm">No Attendance Data Yet</p>
              <p className="text-xs text-foreground/60">Connect portal (Coming soon).</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
          Dashboard
        </h1>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-foreground/30 mt-2 flex items-center gap-2">
          All Systems Functional
        </p>
      </div>

      {/* Danger Zone - Refactored to Ultra-Premium Warning */}
      {dangerZoneTasks.length > 0 && (
        <div className="relative group overflow-hidden rounded-[2.5rem] border border-danger/30 bg-danger/5 backdrop-blur-2xl p-8 shadow-[0_32px_64px_-12px_rgba(239,68,68,0.2)]">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="h-32 w-32 text-danger" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 bg-danger/20 rounded-2xl flex items-center justify-center shadow-inner relative">
                  <ShieldAlert className="h-7 w-7 text-danger" />
                </div>
                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-danger">Deadline Alert</h2>
                  <p className="text-xs font-bold text-danger/60 uppercase tracking-[0.2em]">{dangerZoneTasks.length} CRITICAL TASK{dangerZoneTasks.length > 1 ? 'S' : ''}</p>
                </div>
              </div>
              <Button variant="danger" size="xl" className="rounded-[2rem] px-10 shadow-2xl shadow-danger/20" onClick={() => navigate('/timeline')}>Review Now</Button>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dangerZoneTasks.map(task => {
                const isMissed = task.deadline < now;
                const isDone = task.completedBy?.includes(currentUser?.uid || '') || false;
                return (
                  <div key={task.id} className={`flex flex-col gap-4 p-6 rounded-[2rem] bg-white/5 border border-white/10 ${isMissed ? 'opacity-60' : 'hover:border-primary/30'} transition-all group/item`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] italic ${isMissed ? 'text-foreground/40' : 'text-primary'}`}>
                          {isMissed ? 'Past Objective' : 'Active Deadline'}
                        </span>
                        <p className={`text-lg font-black tracking-tight leading-none uppercase italic ${isMissed ? 'text-foreground/60' : ''}`}>{task.title}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        className={`h-10 w-10 p-0 rounded-xl border border-white/10 ${isDone ? 'text-success bg-success/10' : 'text-foreground/20 hover:text-primary'}`}
                        onClick={() => handleToggleDone(task.id, isDone)}
                      >
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-foreground/40">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{new Date(task.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {!isMissed && <Clock className="h-4 w-4 text-primary/20 animate-pulse" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="grid gap-8 md:grid-cols-12">
        {/* Subjects - Main Column */}
        <div className="md:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="font-black italic uppercase tracking-widest text-sm opacity-40">Academic Subjects</h3>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {subjects.map(subject => {
              const subjectTasks = tasks.filter(t => 
                t.subjectId === subject.id && 
                t.deadline > now && 
                !t.completedBy?.includes(currentUser?.uid || '')
              );
              return (
                <Card 
                  key={subject.id} 
                  className="group hover:scale-[1.02] active:scale-[0.98] cursor-pointer relative overflow-hidden"
                  onClick={() => navigate(`/subjects/${subject.id}`)}
                >
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div className="text-6xl font-black italic leading-none">{subject.code.slice(-2)}</div>
                  </div>
                  <CardHeader className="p-8 pb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner ${
                        subject.type === 'theory' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
                      }`}>
                        {subject.code.toUpperCase()}
                      </div>
                      <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                    </div>
                    <CardTitle className="text-2xl mb-1">{subject.name}</CardTitle>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 italic">{subject.type}</p>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 mt-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/40 rounded-full w-[60%]" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        {subjectTasks.length > 0 ? `${subjectTasks.length} Active` : 'Clear'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="md:col-span-4 space-y-8">
          {/* Events */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <PartyPopper className="h-5 w-5 text-accent" />
              <h3 className="font-black italic uppercase tracking-widest text-sm opacity-40">Upcoming Events</h3>
            </div>
            
            {dashboardEvents.length === 0 ? (
              <Card className="p-10 text-center border-dashed border-white/10 bg-transparent">
                <p className="text-xs font-bold opacity-20 uppercase tracking-widest">No Events Scheduled</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {dashboardEvents.map(event => (
                  <div key={event.id} className="relative group overflow-hidden rounded-[2rem] border border-white/5 bg-accent/5 backdrop-blur-xl p-6 hover:bg-accent/10 transition-all cursor-pointer" onClick={() => navigate('/events')}>
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="h-10 w-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent italic">Confirmed</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-black tracking-tight uppercase italic">{event.title}</h4>
                        <p className="text-xs font-bold opacity-40 mt-1">{event.venue} • {new Date(event.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance Quick Link */}
          <div className="relative group overflow-hidden rounded-[2rem] border border-primary/30 bg-primary/5 p-8 hover:bg-primary/10 transition-all cursor-pointer" onClick={() => navigate('/attendance')}>
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Activity className="h-20 w-20 text-primary" />
             </div>
             <div className="relative z-10 flex flex-col gap-6">
                <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                  <Activity className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xl font-black tracking-tighter uppercase italic">Attendance Monitor</h4>
                  <p className="text-xs font-bold opacity-60 mt-2 leading-relaxed">System integration pending. Click to access manual entry.</p>
                </div>
                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                  Sync Now <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* FTE Modal Upgrade */}
      <Modal isOpen={showFTEModal} onClose={closeFTEModal} title="Setup Complete">
        <div className="text-center space-y-10 py-8 px-4">
          <div className="flex justify-center relative">
            <div className="absolute inset-0 bg-success/20 blur-3xl rounded-full" />
            <div className="relative bg-success/20 p-8 rounded-[2rem] border border-success/30 shadow-2xl">
              <CheckCircle2 className="h-16 w-16 text-success animate-in zoom-in duration-500" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Welcome to RemindrX</h3>
            <p className="text-foreground/40 font-bold uppercase tracking-widest text-[10px]">Your class workspace is now fully synchronized.</p>
          </div>

          <div className="grid gap-4">
             {[
               { icon: BookOpen, label: `${subjects.length} Subjects Loaded`, color: 'primary' },
               { icon: Calendar, label: `${tasks.length} Active Deadlines`, color: 'accent' },
               { icon: Activity, label: 'Attendance Sync Active', color: 'danger' }
             ].map((item, idx) => (
               <div key={idx} className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 text-left transition-all hover:bg-white/10">
                 <div className={`p-2.5 rounded-xl bg-${item.color}/20 text-${item.color}`}>
                   <item.icon className="h-5 w-5" />
                 </div>
                 <p className="font-black italic uppercase tracking-tight text-sm">{item.label}</p>
               </div>
             ))}
          </div>

          <Button size="xl" className="w-full rounded-[2rem] shadow-2xl" onClick={closeFTEModal}>Enter Dashboard</Button>
        </div>
      </Modal>
    </div>
  );
}
