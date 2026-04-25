import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getCountFromServer, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event, ClassData, User, Subject } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CreateSectionModal } from '../components/CreateSectionModal';
import { EditSectionModal } from '../components/EditSectionModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { Calendar, CheckCircle, XCircle, Users, BookOpen, LayoutDashboard, Search, ListTodo, MessageSquare, TrendingUp, Trophy, Plus, Edit2, Trash2, Repeat, Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line 
} from 'recharts';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ClassChangeRequest {
  id: string;
  userId: string;
  userName: string;
  currentClassId: string;
  requestedClassId: string;
  requestedClassCode: string;
  requestedClassName: string;
  status: string;
  createdAt: number;
}

interface Analytics {
  totalUsers: number;
  totalClasses: number;
  totalEvents: number;
  totalSubjects: number;
  totalTasks: number;
  totalPosts: number;
}

export default function SuperAdmin() {
  const { userData, currentUser } = useAuth();
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [crMap, setCrMap] = useState<Record<string, string>>({}); // userId -> name
  const [analytics, setAnalytics] = useState<Analytics>({ 
    totalUsers: 0, totalClasses: 0, totalEvents: 0, totalSubjects: 0, totalTasks: 0, totalPosts: 0 
  });
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDetailTab, setActiveDetailTab] = useState<string | null>(null);
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  // Modal State
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [classDetailsLoading, setClassDetailsLoading] = useState(false);
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Class Change Requests
  const [changeRequests, setChangeRequests] = useState<ClassChangeRequest[]>([]);

  // Chart Data State
  const [chartData, setChartData] = useState<{
    branchDist: { name: string, value: number }[];
    activityMix: { name: string, count: number, fill?: string }[];
    eventTimeline: { date: string, count: number }[];
    categoryDist: { name: string, value: number }[];
    userGrowth: { date: string, count: number }[];
    retentionData: { name: string, value: number }[];
  }>({
    branchDist: [],
    activityMix: [],
    eventTimeline: [],
    categoryDist: [],
    userGrowth: [],
    retentionData: []
  });

  useEffect(() => {
    if (!userData?.isSuperAdmin) return;

    // 1. Listen to all users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(users);
      setAnalytics(prev => ({ ...prev, totalUsers: users.length }));
      const sorted = [...users].sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));
      setTopUsers(sorted.slice(0, 5));
    });

    // 2. Listen to all events
    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      setAllEvents(events);
      setPendingEvents(events.filter(e => e.status === 'pending').sort((a, b) => a.date - b.date));
      setAnalytics(prev => ({ ...prev, totalEvents: events.length }));
      setLoading(false);
    });

    // 3. Listen to all subjects
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      const subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setAllSubjects(subjects);
      setAnalytics(prev => ({ ...prev, totalSubjects: subjects.length }));
    });

    // 4. Listen to Classes
    const unsubClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      const fetchedClasses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClassData));
      setClasses(fetchedClasses);
      setAnalytics(prev => ({ ...prev, totalClasses: fetchedClasses.length }));
    });

    // 5. Fetch static counts once
    const fetchCounts = async () => {
      try {
        const [tasksCount, postsCount] = await Promise.all([
          getCountFromServer(collection(db, 'tasks')),
          getCountFromServer(collection(db, 'posts')),
        ]);
        setAnalytics(prev => ({ 
          ...prev, 
          totalTasks: tasksCount.data().count,
          totalPosts: postsCount.data().count
        }));
      } catch (err) {
        console.error("Error fetching counts", err);
      }
    };
    fetchCounts();

    // 6. Listen to Class Change Requests
    const reqQ = query(collection(db, 'class_change_requests'), where('status', '==', 'pending'));
    const unsubReqs = onSnapshot(reqQ, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassChangeRequest));
      setChangeRequests(reqs.sort((a, b) => b.createdAt - a.createdAt));
    });

    // 7. Fetch CRs (users with role 'admin')
    const fetchCRs = async () => {
      try {
        const adminQ = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminSnap = await getDocs(adminQ);
        const map: Record<string, string> = {};
        adminSnap.docs.forEach(d => { map[d.id] = d.data().name; });
        setCrMap(map);
      } catch (err) {
        console.error("Error fetching CRs", err);
      }
    };
    fetchCRs();

    return () => {
      unsubUsers();
      unsubEvents();
      unsubSubjects();
      unsubClasses();
      unsubReqs();
    };
  }, [userData]);

  // Reactive Chart Data Processing
  useEffect(() => {
    if (allUsers.length === 0 && allEvents.length === 0) return;

    // 1. Branch Distribution
    const branchCounts: Record<string, number> = {};
    allUsers.forEach(u => {
      const b = u.branch || 'Unassigned';
      branchCounts[b] = (branchCounts[b] || 0) + 1;
    });
    const branchDist = Object.entries(branchCounts).map(([name, value]) => ({ name, value }));

    // 2. Event Category Distribution
    const catCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    });
    const categoryDist = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

    // 3. User Growth
    const growthCounts: Record<string, number> = {};
    allUsers.forEach(u => {
      const date = new Date(u.createdAt || (Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      growthCounts[date] = (growthCounts[date] || 0) + 1;
    });
    const userGrowth = Object.entries(growthCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Activity Timeline
    const timelineCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      const date = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timelineCounts[date] = (timelineCounts[date] || 0) + 1;
    });
    const eventTimeline = Object.entries(timelineCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);

    // 5. Activity Mix
    const activityMix = [
      { name: 'Users', count: allUsers.length, fill: '#3b82f6' },
      { name: 'Events', count: allEvents.length, fill: '#10b981' },
      { name: 'Subjects', count: allSubjects.length, fill: '#f59e0b' },
      { name: 'Tasks', count: analytics.totalTasks, fill: '#ef4444' },
      { name: 'Posts', count: analytics.totalPosts, fill: '#8b5cf6' },
    ];

    // 6. User Retention
    const now = Date.now();
    const active24h = allUsers.filter(u => (u.lastActive || 0) > now - 24 * 60 * 60 * 1000).length;
    const active7d = allUsers.filter(u => (u.lastActive || 0) > now - 7 * 24 * 60 * 60 * 1000).length;
    const retentionData = [
      { name: 'Daily Active', value: active24h },
      { name: 'Weekly Active', value: active7d },
      { name: 'Total', value: allUsers.length }
    ];

    setChartData({
      branchDist,
      categoryDist,
      eventTimeline,
      activityMix,
      userGrowth,
      retentionData
    });
  }, [allUsers, allEvents, allSubjects, analytics.totalTasks, analytics.totalPosts]);

  const handleAction = async (eventId: string, status: 'approved' | 'rejected', remarks: string) => {
    try {
      const eventRef = doc(db, 'events', eventId);
      const eventDoc = allEvents.find(e => e.id === eventId);
      if (!eventDoc) return;

      const isModification = !!eventDoc.pendingUpdate;
      const updates: Record<string, any> = { 
        status: status === 'approved' ? 'approved' : (isModification ? 'approved' : 'rejected'),
        moderatorRemarks: remarks,
        pendingUpdate: null // Always clear the pending update after action
      };

      if (status === 'approved' && isModification) {
        // Merge the pending update into the root
        Object.assign(updates, eventDoc.pendingUpdate);
      }

      await updateDoc(eventRef, updates);

      // Create Notification for the creator
      await addDoc(collection(db, 'notifications'), {
        userId: eventDoc.createdBy,
        title: status === 'approved' ? `Event Approved: ${eventDoc.title}` : `Event Update Rejected: ${eventDoc.title}`,
        message: status === 'approved' 
          ? `Great news! Your event "${eventDoc.title}" has been approved and is now live.` 
          : `Your recent changes to "${eventDoc.title}" were not approved. The event remains in its previous state.`,
        remarks: remarks || "No specific remarks provided.",
        type: status === 'approved' ? 'event_approval' : 'event_rejection',
        eventId: eventId,
        createdAt: Date.now(),
        read: false
      });

      toast.success(`Event ${status}!`);
    } catch (error) {
      toast.error('Failed to update event status');
      console.error(error);
    }
  };

  const handleDeleteEvent = async (eventId: string, remarks: string = "") => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    
    try {
      const eventDoc = allEvents.find(e => e.id === eventId);
      if (!eventDoc) return;

      // Notify the creator if a Super Admin deleted it (and it's not the creator themselves)
      if (userData?.isSuperAdmin && eventDoc.createdBy !== currentUser?.uid) {
        console.log(`Attempting to notify creator: ${eventDoc.createdBy}`);
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: eventDoc.createdBy,
            title: `Event Deleted: ${eventDoc.title}`,
            message: `Your event "${eventDoc.title}" has been deleted by a Super Admin.`,
            remarks: remarks || "No specific reason provided.",
            type: 'event_deletion',
            createdAt: Date.now(),
            read: false
          });
          console.log('Notification sent successfully');
          toast.success('Creator notified');
        } catch (notifyError: any) {
          console.error('Notification failed:', notifyError);
          toast.error(`Could not notify creator: ${notifyError.message}`);
        }
      }

      await deleteDoc(doc(db, 'events', eventId));
      toast.success('Event deleted successfully');
      setSelectedEvent(null);
    } catch (error) {
      toast.error('Failed to delete event');
      console.error(error);
    }
  };

  const openClassDetails = async (cls: ClassData) => {
    setSelectedClass(cls);
    setClassDetailsLoading(true);
    try {
      const studentsQ = query(collection(db, 'users'), where('classId', '==', cls.id));
      const subjectsQ = query(collection(db, 'subjects'), where('classId', '==', cls.id));
      
      const [studentsSnap, subjectsSnap] = await Promise.all([
        getDocs(studentsQ),
        getDocs(subjectsQ)
      ]);

      setClassStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setClassSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    } catch (err) {
      toast.error("Failed to load section details");
    } finally {
      setClassDetailsLoading(false);
    }
  };

  const handleDeleteClass = async (cls: ClassData) => {
    if (window.confirm(`Are you absolutely sure you want to delete ${cls.name}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'classes', cls.id));
        toast.success(`${cls.name} deleted successfully`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete section');
      }
    }
  };

  const handleApproveChangeRequest = async (req: ClassChangeRequest) => {
    try {
      // 1. Update user document
      await updateDoc(doc(db, 'users', req.userId), {
        classId: req.requestedClassId
      });
      // 2. Update request status
      await updateDoc(doc(db, 'class_change_requests', req.id), {
        status: 'approved',
        resolvedAt: Date.now()
      });
      toast.success(`Approved transfer for ${req.userName}`);
    } catch (error: any) {
      console.error("Approval error:", error);
      toast.error(`Failed to approve request: ${error.message}`);
    }
  };

  const handleRejectChangeRequest = async (req: ClassChangeRequest) => {
    try {
      await updateDoc(doc(db, 'class_change_requests', req.id), {
        status: 'rejected',
        resolvedAt: Date.now()
      });
      toast.success(`Rejected transfer for ${req.userName}`);
    } catch (error: any) {
      console.error("Rejection error:", error);
      toast.error(`Failed to reject request: ${error.message}`);
    }
  };

  if (!userData?.isSuperAdmin) {
    return <div className="p-8 text-center text-danger">Access Denied. Super Admins only.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
        <p className="text-foreground/60">Overview of RemindrX operations</p>
      </div>

      {loading ? (
        <div className="animate-pulse grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-card rounded-xl"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { id: 'users', label: 'Users', count: analytics.totalUsers, icon: Users, color: 'primary' },
              { id: 'classes', label: 'Classes', count: analytics.totalClasses, icon: LayoutDashboard, color: 'accent' },
              { id: 'events', label: 'Events', count: analytics.totalEvents, icon: Calendar, color: 'success' },
              { id: 'subjects', label: 'Subjects', count: analytics.totalSubjects, icon: BookOpen, color: 'warning' },
              { id: 'tasks', label: 'Tasks', count: analytics.totalTasks, icon: ListTodo, color: 'danger' },
              { id: 'posts', label: 'Updates', count: analytics.totalPosts, icon: MessageSquare, color: 'primary' }
            ].map(stat => (
              <Card 
                key={stat.id}
                className={`bg-${stat.color}/5 border-${stat.color}/20 cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${activeDetailTab === stat.id ? `ring-2 ring-${stat.color} shadow-lg scale-105` : ''}`}
                onClick={() => setActiveDetailTab(activeDetailTab === stat.id ? null : stat.id)}
              >
                <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                  <stat.icon className={`h-5 w-5 text-${stat.color} mb-2`} />
                  <h3 className={`text-3xl font-black text-${stat.color}`}>{stat.count}</h3>
                  <p className={`text-xs font-medium text-${stat.color}/80 mt-1 uppercase tracking-wider`}>{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 2. Detailed View Section */}
          {activeDetailTab && (
            <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filterProgram}
                  onChange={e => setFilterProgram(e.target.value)}
                >
                  <option value="">All Programs</option>
                  {[...new Set([
                    ...classes.map(c => c.program).filter(Boolean),
                    ...allUsers.map(u => u.program).filter(Boolean)
                  ])].sort().map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filterBranch}
                  onChange={e => setFilterBranch(e.target.value)}
                >
                  <option value="">All Branches</option>
                  {[...new Set(classes.map(c => c.branch).filter(Boolean))].sort().map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select
                  className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filterYear}
                  onChange={e => setFilterYear(e.target.value)}
                >
                  <option value="">All Years</option>
                  {[...new Set(classes.map(c => c.year).filter(Boolean))].sort().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {(filterProgram || filterBranch || filterYear) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setFilterProgram(''); setFilterBranch(''); setFilterYear(''); }}
                    className="text-xs text-danger hover:underline"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Detail Blocks */}
              {activeDetailTab === 'classes' && (() => {
                const filtered = classes.filter(cls =>
                  (!filterProgram || cls.program === filterProgram) &&
                  (!filterBranch || cls.branch === filterBranch) &&
                  (!filterYear || cls.year === filterYear)
                );
                return (
                  <Card className="border-accent/30 bg-accent/5">
                    <CardHeader className="border-b border-accent/10"><CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-accent" /> Classes Detail ({filtered.length})</CardTitle></CardHeader>
                    <CardContent className="p-0 max-h-96 overflow-y-auto">
                      <div className="divide-y divide-accent/10">
                        {filtered.map(cls => {
                          const strength = allUsers.filter(u => u.classId === cls.id).length;
                          const crNames = cls.admins?.map(id => crMap[id] || 'Unknown').filter(Boolean) || [];
                          const clsSubjects = allSubjects.filter(s => s.classId === cls.id);
                          const theoryCount = clsSubjects.filter(s => s.type === 'theory').length;
                          const labCount = clsSubjects.filter(s => s.type === 'lab').length;
                          return (
                            <div key={cls.id} className="p-4 hover:bg-accent/10 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold">{cls.name}</p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    {cls.program && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/10 text-primary">{cls.program}</span>}
                                    {cls.branch && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-accent/10 text-accent">{cls.branch}</span>}
                                    {cls.year && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-foreground/10 text-foreground/60">Year {cls.year}</span>}
                                  </div>
                                  {crNames.length > 0 && (
                                    <p className="text-xs text-foreground/50 mt-2">CRs: <span className="text-foreground/70 font-medium">{crNames.join(', ')}</span></p>
                                  )}
                                </div>
                                <div className="text-right shrink-0 space-y-1.5">
                                  <p className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{cls.joinCode}</p>
                                  <div className="flex items-center justify-end gap-3 text-xs">
                                    <span className="text-foreground/60"><strong className="text-foreground font-bold">{strength}</strong> students</span>
                                  </div>
                                  <div className="flex items-center justify-end gap-2 text-[10px]">
                                    <span className="text-warning font-bold">{theoryCount} theory</span>
                                    <span className="text-foreground/30">•</span>
                                    <span className="text-accent font-bold">{labCount} lab</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openClassDetails(cls)}>View</Button>
                                    <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" onClick={() => handleDeleteClass(cls)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {activeDetailTab === 'users' && (() => {
                const matchingClassIds = classes
                  .filter(c => (!filterProgram || c.program === filterProgram) && (!filterBranch || c.branch === filterBranch) && (!filterYear || c.year === filterYear))
                  .map(c => c.id);
                const filtered = allUsers.filter(u => {
                  if (!filterProgram && !filterBranch && !filterYear) return true;
                  if (u.classId && matchingClassIds.includes(u.classId)) return true;
                  return false;
                });
                return (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="border-b border-primary/10"><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Users Detail ({filtered.length})</CardTitle></CardHeader>
                    <CardContent className="p-0 max-h-96 overflow-y-auto">
                      <div className="divide-y divide-primary/10">
                        {filtered.map(user => (
                          <div key={user.id} className="p-4 flex items-center justify-between hover:bg-primary/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">{user.name?.charAt(0).toUpperCase() || 'U'}</div>
                              <div>
                                <p className="text-sm font-semibold">{user.name}</p>
                                <p className="text-xs text-foreground/50">{user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {user.program && <span className="hidden sm:inline px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/10 text-primary">{user.program}</span>}
                              <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded ${user.role === 'admin' ? 'bg-danger/10 text-danger' : 'bg-foreground/10 text-foreground/60'}`}>{user.role}</span>
                              <span className="text-xs font-mono font-bold text-accent">{user.trustScore || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {activeDetailTab === 'subjects' && (() => {
                const matchingClassIds = classes
                  .filter(c => (!filterProgram || c.program === filterProgram) && (!filterBranch || c.branch === filterBranch) && (!filterYear || c.year === filterYear))
                  .map(c => c.id);
                const filtered = allSubjects.filter(s => !filterProgram && !filterBranch && !filterYear ? true : matchingClassIds.includes(s.classId));
                return (
                  <Card className="border-warning/30 bg-warning/5">
                    <CardHeader className="border-b border-warning/10"><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-warning" /> Subjects Detail ({filtered.length})</CardTitle></CardHeader>
                    <CardContent className="p-0 max-h-96 overflow-y-auto">
                      <div className="divide-y divide-warning/10">
                        {filtered.map(sub => {
                          const parentClass = classes.find(c => c.id === sub.classId);
                          return (
                            <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-warning/10 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${sub.type === 'theory' ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'}`}>{sub.code}</div>
                                <div>
                                  <p className="text-sm font-semibold">{sub.name}</p>
                                  <p className="text-xs text-foreground/50">{parentClass?.name || 'Unknown Class'}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded ${sub.type === 'theory' ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'}`}>{sub.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {activeDetailTab === 'events' && (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader className="border-b border-success/10"><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-success" /> Events Detail ({allEvents.length})</CardTitle></CardHeader>
                  <CardContent className="p-0 max-h-96 overflow-y-auto">
                    <div className="divide-y divide-success/10">
                      {[...allEvents].sort((a, b) => b.date - a.date).map(event => (
                        <div key={event.id} className="p-4 flex items-center justify-between hover:bg-success/10 transition-colors cursor-pointer" onClick={() => setSelectedEvent(event)}>
                          <div className="flex items-center gap-3">
                            <div className="text-center w-12 shrink-0">
                              <span className="text-[10px] font-bold text-foreground/60 uppercase block">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                              <span className="text-lg font-bold">{new Date(event.date).getDate()}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{event.title}</p>
                              <p className="text-xs text-foreground/50">{event.venue} • {event.organizer}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-primary">{event.goingCount || 0} going</span>
                            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded ${event.status === 'approved' ? 'bg-success text-white' : event.status === 'pending' ? 'bg-warning text-white' : 'bg-danger text-white'}`}>{event.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 3. Visual Analytics Section */}
          <div className="space-y-6 pt-10 border-t border-border/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Ecosystem Intelligence</h2>
                  <p className="text-xs text-foreground/50">Real-time platform growth & engagement metrics</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-success/10 border border-success/20 rounded-full">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-black text-success uppercase tracking-wider">Live Processing</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-2 bg-card/40 backdrop-blur-md border-border/40 overflow-hidden shadow-xl shadow-primary/5 group">
                <CardHeader className="pb-2 border-b border-border/10 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">User Onboarding Velocity</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] w-full pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.userGrowth}>
                      <defs>
                        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                      <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} dy={10} stroke="hsl(var(--foreground)/0.4)" />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} dx={-10} stroke="hsl(var(--foreground)/0.4)" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border)/0.5)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#growthGradient)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-md border-border/40 overflow-hidden shadow-xl shadow-success/5">
                <CardHeader className="pb-2 border-b border-border/10">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">User Retention Cycle</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] w-full pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.retentionData}>
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--success))" radius={[12, 12, 0, 0]} barSize={45}>
                        {chartData.retentionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : index === 1 ? 'hsl(var(--accent))' : 'hsl(var(--success))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <Card className="bg-card/40 backdrop-blur-md border-border/40 overflow-hidden shadow-lg group">
                <CardHeader className="pb-2 border-b border-border/10">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Engagement Mix</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] w-full pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.activityMix} layout="vertical" margin={{ left: -20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" fontSize={10} width={80} tickLine={false} axisLine={false} stroke="hsl(var(--foreground)/0.6)" />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--primary)/0.05)' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border)/0.5)' }}
                      />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-md border-border/40 overflow-hidden shadow-lg">
                <CardHeader className="pb-2 border-b border-border/10">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Branch Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] w-full pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.branchDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.branchDist.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-md border-border/40 overflow-hidden shadow-lg">
                <CardHeader className="pb-2 border-b border-border/10">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Event Pulse</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] w-full pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.eventTimeline}>
                      <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px' }} />
                      <Area type="stepAfter" dataKey="count" stroke="hsl(var(--accent))" fill="hsl(var(--accent)/0.1)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 4. Supplemental Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 border-t border-border/10">
            <Card className="lg:col-span-2 border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Top Contributors</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {topUsers.map((user, idx) => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-warning/20 text-warning' : 'bg-primary/10 text-primary'}`}>{idx + 1}</div>
                        <div>
                          <p className="text-sm font-bold">{user.name}</p>
                          <p className="text-[10px] text-foreground/50">{user.email}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-accent">{user.trustScore}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-bold">Platform Stats</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/60">Avg. Events / Week</span>
                  <span className="text-sm font-bold">{(analytics.totalEvents / 4).toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/60">Active CRs</span>
                  <span className="text-sm font-bold">{Object.keys(crMap).length}</span>
                </div>
                <div className="pt-2">
                  <Button variant="outline" className="w-full text-xs gap-2" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="h-3 w-3" /> New Section
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Pending Moderation */}
      <div className="pt-10 border-t border-border/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-warning/10 rounded-lg">
            <CheckCircle className="h-6 w-6 text-warning" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pending Moderation</h2>
            <p className="text-xs text-foreground/50">Verify and approve community-submitted events</p>
          </div>
        </div>

        {pendingEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/10 rounded-2xl bg-card/20">
            <CheckCircle className="h-10 w-10 text-success mb-2 opacity-20" />
            <p className="text-foreground/40 font-medium">All caught up! No pending events.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingEvents.map(event => (
              <Card key={event.id} className="group hover:border-primary/40 transition-colors shadow-lg overflow-hidden flex flex-col">
                <div className="h-2 bg-warning/40" />
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-warning/10 text-warning px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                      {event.category}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground/40 uppercase">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                      <p className="text-xl font-black">{new Date(event.date).getDate()}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">{event.title}</h3>
                  <p className="text-xs text-foreground/60 mb-4 line-clamp-2">{event.description}</p>
                  
                  <div className="space-y-2 mb-6 text-xs text-foreground/50 mt-auto">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      <span>{event.organizer}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 text-xs font-bold" 
                      onClick={() => setSelectedEvent(event)}
                    >
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Class Change Requests */}
      <div className="pt-10 border-t border-border/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Repeat className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Transfer Requests</h2>
            <p className="text-xs text-foreground/50">Manage student requests to change sections</p>
          </div>
        </div>

        {changeRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/10 rounded-2xl bg-card/20">
            <Repeat className="h-10 w-10 text-primary mb-2 opacity-20" />
            <p className="text-foreground/40 font-medium">No pending transfer requests.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {changeRequests.map(req => (
              <Card key={req.id} className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase">
                      {req.userName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{req.userName}</p>
                      <p className="text-[10px] text-foreground/50">{new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50 mb-6">
                    <div className="text-center flex-1">
                      <p className="text-[10px] uppercase font-bold text-foreground/40 mb-1">From</p>
                      <p className="text-xs font-bold text-danger">{req.requestedClassName ? 'Current' : 'None'}</p>
                    </div>
                    <Repeat className="h-4 w-4 text-primary opacity-40 mx-2" />
                    <div className="text-center flex-1">
                      <p className="text-[10px] uppercase font-bold text-foreground/40 mb-1">To</p>
                      <p className="text-xs font-bold text-success">{req.requestedClassName}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-success hover:bg-success/90 text-white text-xs font-bold"
                      onClick={() => handleApproveChangeRequest(req)}
                    >
                      Approve
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 border-danger/20 text-danger hover:bg-danger/10 text-xs font-bold"
                      onClick={() => handleRejectChangeRequest(req)}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateSectionModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />

      {editingClass && (
        <EditSectionModal
          isOpen={!!editingClass}
          onClose={() => setEditingClass(null)}
          section={editingClass}
        />
      )}

      {selectedClass && (
        <Modal 
          isOpen={!!selectedClass} 
          onClose={() => setSelectedClass(null)}
          title={selectedClass.name}
        >
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-[10px] uppercase font-black text-primary/60 mb-1">Join Code</p>
                <p className="text-xl font-mono font-bold text-primary">{selectedClass.joinCode}</p>
              </div>
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
                <p className="text-[10px] uppercase font-black text-accent/60 mb-1">Admin Code</p>
                <p className="text-xl font-mono font-bold text-accent">{selectedClass.adminInviteCode}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="px-3 py-1 rounded-full bg-foreground/5 font-medium">Program: {selectedClass.program || 'N/A'}</div>
              <div className="px-3 py-1 rounded-full bg-foreground/5 font-medium">Year: {selectedClass.year || 'N/A'}</div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Students ({classStudents.length})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {classStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50">
                    <span className="text-sm font-medium">{student.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${student.role === 'admin' ? 'bg-danger text-white' : 'bg-foreground/10'}`}>{student.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h4 className="font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent" /> Subjects ({classSubjects.length})
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {classSubjects.map(sub => (
                  <div key={sub.id} className="p-2 rounded-lg bg-card border border-border/50 text-xs">
                    <span className="font-bold opacity-50 block text-[9px]">{sub.code}</span>
                    <span className="font-medium">{sub.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setEditingClass(selectedClass); setSelectedClass(null); }}>Edit Class</Button>
              <Button variant="outline" className="flex-1 border-danger/20 text-danger hover:bg-danger/5" onClick={() => { handleDeleteClass(selectedClass); setSelectedClass(null); }}>Delete Class</Button>
            </div>
          </div>
        </Modal>
      )}

      <EventDetailModal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        onApprove={(id, remarks) => handleAction(id, 'approved', remarks)}
        onReject={(id, remarks) => handleAction(id, 'rejected', remarks)}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
