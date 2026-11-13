import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task, Subject, Event, EventParticipation } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Calendar, BookOpen, PartyPopper, Activity, ArrowRight, CheckCircle2, ShieldAlert, Clock, Circle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { toast } from 'react-hot-toast';
import { usePortalSession } from '../hooks/usePortalSession';
import { useNow } from '../hooks/useNow';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function Dashboard() {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();
  const portal = usePortalSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const isFirstTime = searchParams.get('firstTime') === 'true';
  const [showFTEModal, setShowFTEModal] = useState(false);

  const classId = userData?.classId;
  const uid = currentUser?.uid;

  useEffect(() => {
    async function fetchDashboardData() {
      if (!classId) return;
      try {
        const now = Date.now();
        // Bounded windows: missed tasks from the last 2 weeks + everything upcoming
        // (max 100), and approved events from yesterday onward (max 30).
        const [subSnap, taskSnap, eventSnap, partSnap] = await Promise.all([
          getDocs(query(collection(db, 'subjects'), where('classId', '==', classId), where('isActive', '==', true), limit(100))),
          getDocs(query(
            collection(db, 'tasks'),
            where('classId', '==', classId),
            where('deadline', '>=', now - 14 * DAY_MS),
            orderBy('deadline', 'asc'),
            limit(100)
          )),
          getDocs(query(
            collection(db, 'events'),
            where('status', '==', 'approved'),
            where('date', '>=', now - DAY_MS),
            orderBy('date', 'asc'),
            limit(30)
          )),
          uid
            ? getDocs(query(collection(db, 'event_participations'), where('userId', '==', uid), where('status', '==', 'going'), limit(100)))
            : Promise.resolve(null),
        ]);
        setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
        setTasks(taskSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
        setEvents(eventSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
        if (partSnap) setParticipations(partSnap.docs.map(d => (d.data() as EventParticipation).eventId));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [classId, uid]);

  useEffect(() => {
    if (!loading && isFirstTime) setShowFTEModal(true);
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
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        completedBy: isDone ? (t.completedBy || []).filter(id => id !== currentUser.uid) : [...(t.completedBy || []), currentUser.uid]
      } : t));
      if (!isDone) toast.success('Marked as done', { position: 'bottom-right' });
    } catch {
      toast.error('Sync failed');
    }
  };

  const now = useNow();
  const deadlineDays = userData?.deadlinePreference || 2;
  const deadlineTime = deadlineDays * 24 * 60 * 60 * 1000;

  const dangerZoneTasks = tasks.filter(t => {
    const isDone = t.completedBy?.includes(currentUser?.uid || '') || false;
    const isMissed = !isDone && t.deadline < now;
    const isUpcoming = !isDone && t.deadline > now && t.deadline <= now + deadlineTime;
    return isMissed || isUpcoming;
  });

  const dashboardEvents = events
    .filter(e => e.date > now && participations.includes(e.id))
    .sort((a, b) => a.date - b.date)
    .slice(0, 2);

  if (loading) return <PageSkeleton rows={4} />;

  if (subjects.length === 0 && tasks.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={`Welcome, ${userData?.name?.split(' ')[0] || 'there'}`}
        description="Your section is brand new. Ask your CR to add subjects, or connect attendance from the GLA portal."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate('/attendance')}>Open attendance</Button>
            <Button variant="secondary" onClick={() => navigate('/timeline')}>Open timeline</Button>
          </div>
        }
      />
    );
  }

  const firstName = userData?.name?.split(' ')[0] || 'User';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const activeTasks = tasks.filter(t => t.deadline > now && !t.completedBy?.includes(currentUser?.uid || '')).length;
  const upcomingEvents = events.filter(e => e.date > now).length;

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow={greeting}
        title={`Hello, ${firstName}`}
        description="Here’s what needs attention across your section."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Subjects" value={subjects.length} icon={BookOpen} onClick={() => navigate('/subjects')} />
        <StatCard label="Active tasks" value={activeTasks} icon={Clock} tone="warning" onClick={() => navigate('/timeline')} />
        <StatCard label="Upcoming events" value={upcomingEvents} icon={Calendar} tone="accent" onClick={() => navigate('/events')} />
      </div>

      {(portal.summary.overall !== '--' || portal.waking || portal.stale) && (
        <Card elevated className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tracking-tight">GLA attendance</p>
                  {portal.live ? (
                    <Badge tone="primary">Live</Badge>
                  ) : portal.waking ? (
                    <Badge>Waking portal…</Badge>
                  ) : portal.stale ? (
                    <Badge tone="warning">Stale</Badge>
                  ) : (
                    <Badge>Cached</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Overall {portal.summary.overall}% · CPI {portal.summary.cpi}
                  {portal.lastSyncedAt
                    ? ` · synced ${new Date(portal.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void portal.refresh()}
                disabled={portal.waking}
              >
                <RefreshCw className={`h-4 w-4 ${portal.waking ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => navigate('/attendance')}>Open attendance</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {dangerZoneTasks.length > 0 && (
        <Card className="overflow-hidden border-danger/30 bg-danger/5" elevated>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/15 text-danger">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-danger">Deadline alert</CardTitle>
                <p className="text-sm text-danger/70">
                  {dangerZoneTasks.length} {dangerZoneTasks.length === 1 ? 'deadline needs attention' : 'deadlines need attention'}
                </p>
              </div>
            </div>
            <Button variant="danger" onClick={() => navigate('/timeline')}>Open timeline</Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dangerZoneTasks.map(task => {
                const isMissed = task.deadline < now;
                const isDone = task.completedBy?.includes(currentUser?.uid || '') || false;
                return (
                  <div key={task.id} className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={isMissed ? 'neutral' : 'danger'}>{isMissed ? 'Overdue' : 'Coming up'}</Badge>
                        <p className="mt-2 font-semibold tracking-tight">{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(task.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        className={`h-10 w-10 p-0 ${isDone ? 'text-success bg-success/10' : ''}`}
                        onClick={() => handleToggleDone(task.id, isDone)}
                      >
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground">Subjects</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {subjects.map(subject => {
              const subjectTasks = tasks.filter(t =>
                t.subjectId === subject.id &&
                t.deadline > now &&
                !t.completedBy?.includes(currentUser?.uid || '')
              );
              return (
                <Card
                  key={subject.id}
                  interactive
                  className="cursor-pointer"
                  onClick={() => navigate(`/subjects/${subject.id}`)}
                >
                  <CardHeader>
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-xs font-semibold ${
                        subject.type === 'theory' ? 'bg-primary-soft text-primary' : 'bg-accent/15 text-accent'
                      }`}>
                        {subject.code.toUpperCase()}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <CardTitle>{subject.name}</CardTitle>
                    <p className="text-xs capitalize text-muted-foreground">{subject.type}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {subjectTasks.length > 0 ? `${subjectTasks.length} open ${subjectTasks.length === 1 ? 'task' : 'tasks'}` : 'No open tasks'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <PartyPopper className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-muted-foreground">Upcoming events</h2>
            </div>
            {dashboardEvents.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No events you're going to"
                description="Join an event to pin it here."
                className="py-10"
              />
            ) : (
              dashboardEvents.map(event => (
                <Card key={event.id} interactive className="cursor-pointer p-5" onClick={() => navigate('/events')}>
                  <Badge tone="accent">Confirmed</Badge>
                  <h3 className="mt-3 font-semibold tracking-tight">{event.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.venue} · {new Date(event.date).toLocaleDateString()}
                  </p>
                </Card>
              ))
            )}
          </div>

          <Card interactive className="cursor-pointer overflow-hidden border-primary/25 bg-primary-soft/40 p-6" onClick={() => navigate('/attendance')}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Attendance</h3>
            <p className="mt-2 text-sm text-muted-foreground">Connect the GLA portal to see attendance and your timetable.</p>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
              Open attendance <ArrowRight className="h-3.5 w-3.5" />
            </p>
          </Card>
        </div>
      </div>

      <Modal isOpen={showFTEModal} onClose={closeFTEModal} title="Setup complete">
        <div className="space-y-6 py-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">Welcome to RemindrX</h3>
            <p className="mt-2 text-sm text-muted-foreground">You’re in. Here’s what is already set up.</p>
          </div>
          <div className="grid gap-3 text-left">
            {[
              { icon: BookOpen, label: `${subjects.length} subjects loaded` },
              { icon: Calendar, label: `${tasks.length} tasks on the timeline` },
              { icon: Activity, label: 'Attendance is ready to connect' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{item.label}</p>
              </div>
            ))}
          </div>
          <Button size="lg" className="w-full" onClick={closeFTEModal}>Enter dashboard</Button>
        </div>
      </Modal>
    </div>
  );
}
