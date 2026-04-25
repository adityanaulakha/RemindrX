import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task, Subject, Event, EventParticipation } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertTriangle, Calendar, BookOpen, PartyPopper, Activity, ArrowRight, PlusCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

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

  const now = Date.now();
  const fortyEightHours = 48 * 60 * 60 * 1000;

  // Filter Danger Zone Tasks
  const dangerZoneTasks = tasks.filter(t => t.deadline > now && t.deadline <= now + fortyEightHours);

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
        <h1 className="text-3xl font-bold tracking-tight mb-3">Welcome to RemindrX!</h1>
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
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-foreground/60">What should you care about today?</p>
      </div>

      {/* Danger Zone */}
      {dangerZoneTasks.length > 0 && (
        <Card className="border-danger bg-danger/5 shadow-danger/10 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-danger" />
              <CardTitle className="text-danger text-xl">Danger Zone</CardTitle>
            </div>
            <span className="text-sm font-bold text-danger bg-danger/10 px-3 py-1 rounded-full">
              {dangerZoneTasks.length} {dangerZoneTasks.length === 1 ? 'deadline' : 'deadlines'} in next 48 hours
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              {dangerZoneTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between rounded-lg bg-card border border-danger/20 p-3 shadow-sm">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{task.title}</p>
                    <p className="text-xs text-foreground/60 mt-0.5">{new Date(task.deadline).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {task.priority === 'critical' && <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] uppercase font-bold text-white tracking-wider">Critical</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-12">
        {/* Subjects List */}
        <Card className="md:col-span-8">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4 border-b border-border">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle>Your Subjects</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 p-0">
            {subjects.length === 0 ? (
              <p className="p-6 text-center text-foreground/50 text-sm">No active subjects found.</p>
            ) : (
              <div className="divide-y divide-border">
                {subjects.map(subject => {
                  const subjectTasks = tasks.filter(t => t.subjectId === subject.id && t.deadline > now);
                  return (
                    <div 
                      key={subject.id} 
                      onClick={() => navigate(`/subjects/${subject.id}`)}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                          subject.type === 'theory' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                        }`}>
                          {subject.code}
                        </div>
                        <div>
                          <p className="font-semibold group-hover:text-primary transition-colors">{subject.name}</p>
                          <p className="text-xs text-foreground/60">{subject.type === 'theory' ? 'Theory' : 'Lab'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {subjectTasks.length > 0 && (
                          <span className="text-xs font-medium bg-foreground/10 px-2.5 py-1 rounded-full">
                            {subjectTasks.length} task{subjectTasks.length > 1 ? 's' : ''} due
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-4 space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <PartyPopper className="h-5 w-5 text-accent" />
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardEvents.length === 0 ? (
                <p className="text-center text-sm text-foreground/50 py-4">No upcoming events.</p>
              ) : (
                <div className="space-y-3 mt-2">
                  {dashboardEvents.map(event => (
                    <div key={event.id} className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-center">
                      <p className="text-sm font-semibold text-accent mb-1">{event.title}</p>
                      <p className="text-xs text-foreground/60 mb-3">{event.venue} • {new Date(event.date).toLocaleDateString()}</p>
                      <button 
                        onClick={() => navigate('/events')}
                        className="text-[10px] uppercase tracking-wider font-bold bg-accent/20 text-accent px-3 py-1.5 rounded-full hover:bg-accent hover:text-white transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Module Link */}
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => navigate('/attendance')}>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <Activity className="h-5 w-5 text-primary group-hover:animate-pulse" />
              <CardTitle>Attendance Buddy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between mt-2 group-hover:bg-primary/10 transition-colors">
                <div>
                  <p className="text-sm font-bold text-foreground">Sync your portal</p>
                  <p className="text-xs text-foreground/60 mt-1">Check "Can I Bunk?"</p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* First-Time Experience Modal */}
      <Modal isOpen={showFTEModal} onClose={closeFTEModal} title="You're in! 🎉">
        <div className="text-center space-y-6 py-4">
          <div className="flex justify-center">
            <div className="bg-success/10 p-4 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-2">Welcome to your new class!</h3>
            <p className="text-foreground/70 text-sm">Here is what's waiting for you right now:</p>
          </div>

          <div className="grid gap-3 max-w-xs mx-auto">
            <div className="p-3 bg-card rounded-lg border border-border flex items-center gap-3 text-left">
              <div className="bg-primary/20 p-2 rounded-lg text-primary"><BookOpen className="h-4 w-4" /></div>
              <div>
                <p className="font-bold">{subjects.length} Subjects Loaded</p>
              </div>
            </div>
            <div className="p-3 bg-card rounded-lg border border-border flex items-center gap-3 text-left">
              <div className="bg-accent/20 p-2 rounded-lg text-accent"><Calendar className="h-4 w-4" /></div>
              <div>
                <p className="font-bold">{tasks.length} Upcoming Deadlines</p>
              </div>
            </div>
            <div className="p-3 bg-card rounded-lg border border-border flex items-center gap-3 text-left">
              <div className="bg-danger/20 p-2 rounded-lg text-danger"><Activity className="h-4 w-4" /></div>
              <div>
                <p className="font-bold">No Attendance Data Yet</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={closeFTEModal}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Let's Go!
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
