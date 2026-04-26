import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getCountFromServer, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event, ClassData, User, Subject, Institute } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { CreateSectionModal } from '../components/CreateSectionModal';
import { EditSectionModal } from '../components/EditSectionModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { Calendar, CheckCircle, XCircle, Users, BookOpen, LayoutDashboard, Search, ListTodo, MessageSquare, TrendingUp, Trophy, Plus, Edit2, Trash2, Repeat, Share2, School, Globe, Settings, ShieldAlert, Activity, RefreshCw, ShieldCheck, Copy } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<string | null>(null);
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [activeTab, setActiveTab] = useState<'analytics' | 'events' | 'classes' | 'institutes' | 'requests'>('analytics');

  // Institute State
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [isInstituteModalOpen, setIsInstituteModalOpen] = useState(false);
  const [editingInstitute, setEditingInstitute] = useState<Institute | null>(null);
  const [newInstName, setNewInstName] = useState('');
  const [newInstDomains, setNewInstDomains] = useState('');

  // Modal State
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [classDetailsLoading, setClassDetailsLoading] = useState(false);
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState<Partial<Subject>>({});

  // Stats & Cooldown
  const [refreshTimer, setRefreshTimer] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const fetchData = async (force = false) => {
    if (!userData?.isSuperAdmin || (refreshTimer > 0 && !force)) return;
    
    setIsRefreshing(true);
    setLoading(true);

    try {
      // 1. Fetch Stats (Cheap Aggregations)
      const [uCount, cCount, eCount, sCount, tCount, pCount] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'classes')),
        getCountFromServer(collection(db, 'events')),
        getCountFromServer(collection(db, 'subjects')),
        getCountFromServer(collection(db, 'tasks')),
        getCountFromServer(collection(db, 'posts')),
      ]);

      setAnalytics({
        totalUsers: uCount.data().count,
        totalClasses: cCount.data().count,
        totalEvents: eCount.data().count,
        totalSubjects: sCount.data().count,
        totalTasks: tCount.data().count,
        totalPosts: pCount.data().count
      });

      // 2. Fetch Active Lists based on current view or basic needs
      const [instSnap, pendingEventsSnap, changeReqSnap, usersSnap, eventsSnap, subjectsSnap] = await Promise.all([
        getDocs(query(collection(db, 'institutes'), orderBy('name', 'asc'))),
        getDocs(query(collection(db, 'events'), where('status', '==', 'pending'))),
        getDocs(collection(db, 'class_change_requests')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'events'), orderBy('date', 'desc'), limit(100))),
        getDocs(collection(db, 'subjects'))
      ]);

      setInstitutes(instSnap.docs.map(d => ({ id: d.id, ...d.data() } as Institute)));
      setPendingEvents(pendingEventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
      setChangeRequests(changeReqSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClassChangeRequest)));
      
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(users);
      setTopUsers([...users].sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0)).slice(0, 5));

      setAllEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
      setAllSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));

      // 3. Conditional fetches for classes (keeping it conditional if expensive, but it's usually small)
      if (activeDetailTab === 'classes' || activeTab === 'classes') fetchDetailedClasses();

      // Trigger cooldown
      setRefreshTimer(10);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error('Data Sync Failed');
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const fetchDetailedUsers = async () => {
    const snap = await getDocs(query(collection(db, 'users'), limit(100)));
    const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    setAllUsers(users);
    setTopUsers([...users].sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0)).slice(0, 5));
  };

  const fetchDetailedClasses = async () => {
    const snap = await getDocs(collection(db, 'classes'));
    setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassData)));
  };

  const fetchDetailedEvents = async () => {
    const snap = await getDocs(query(collection(db, 'events'), orderBy('date', 'desc'), limit(50)));
    setAllEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
  };

  const fetchDetailedSubjects = async () => {
    const snap = await getDocs(collection(db, 'subjects'));
    setAllSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
  };

  useEffect(() => {
    fetchData();

    const handleGlobalRefresh = () => fetchData(true);
    window.addEventListener('app-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('app-refresh', handleGlobalRefresh);
  }, [userData]);

  useEffect(() => {
    if (refreshTimer > 0) {
      const interval = setInterval(() => setRefreshTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [refreshTimer]);

  useEffect(() => {
    // Re-fetch when switching tabs if data is missing
    if ((activeDetailTab === 'users' || activeTab === 'analytics') && allUsers.length === 0) fetchDetailedUsers();
    if ((activeDetailTab === 'classes' || activeTab === 'classes') && classes.length === 0) fetchDetailedClasses();
    if ((activeDetailTab === 'events' || activeTab === 'events') && allEvents.length === 0) fetchDetailedEvents();
    if ((activeDetailTab === 'subjects' || activeTab === 'classes') && allSubjects.length === 0) fetchDetailedSubjects();
  }, [activeDetailTab, activeTab]);

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

  const approveEvent = (id: string) => handleAction(id, 'approved', 'Approved via Command Center');
  const rejectEvent = (id: string) => handleAction(id, 'rejected', 'Rejected via Command Center');

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

  const handleInstituteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const domains = newInstDomains.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
      if (editingInstitute) {
        await updateDoc(doc(db, 'institutes', editingInstitute.id), {
          name: newInstName,
          domains
        });
        toast.success('Institute updated');
      } else {
        await addDoc(collection(db, 'institutes'), {
          name: newInstName,
          domains,
          createdAt: Date.now()
        });
        toast.success('Institute created');
      }
      setIsInstituteModalOpen(false);
      setEditingInstitute(null);
      setNewInstName('');
      setNewInstDomains('');
    } catch (e) {
      toast.error('Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubject = async () => {
    if (!subjectForm.name || !subjectForm.code || !subjectForm.classId) {
      toast.error('Missing core specifications');
      return;
    }

    try {
      if (subjectForm.id) {
        await updateDoc(doc(db, 'subjects', subjectForm.id), {
          name: subjectForm.name,
          code: subjectForm.code,
          credits: subjectForm.credits || 0,
          type: subjectForm.type || 'theory'
        });
        toast.success('Unit recalibrated');
      } else {
        await addDoc(collection(db, 'subjects'), {
          ...subjectForm,
          isActive: true,
          createdBy: 'system'
        });
        toast.success('New unit deployed');
      }
      setIsEditingSubject(false);
      setSubjectForm({});
    } catch (error) {
      toast.error('Specification error');
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Purge this academic unit? This action is permanent.')) return;
    try {
      await deleteDoc(doc(db, 'subjects', id));
      toast.success('Unit purged');
    } catch (error) {
      toast.error('Purge failed');
    }
  };

  const deleteInstitute = async (id: string) => {
    if (!confirm('Are you sure? This will not delete linked classes but they will lose their institution association.')) return;
    try {
      await deleteDoc(doc(db, 'institutes', id));
      toast.success('Institute deleted');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  if (!userData?.isSuperAdmin) {
    return <div className="p-8 text-center text-danger">Access Denied. Super Admins only.</div>;
  }

  return (
    <div className="min-h-screen space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Cinematic Command Header */}
      <div className="relative overflow-hidden rounded-[3.5rem] bg-card/40 backdrop-blur-xl border border-white/10 p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <ShieldCheck className="h-64 w-64 text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">Management Console</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
              Super Admin
            </h1>
            <p className="text-sm font-medium text-foreground/40 max-w-xl leading-relaxed">
              Global platform management. Monitoring {analytics.totalUsers} users across {institutes.length} institutions. 
              Real-time oversight and moderation active.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 p-2 bg-white/5 rounded-[2.5rem] border border-white/5 shadow-inner">
            {[
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'events', label: 'Events', icon: Calendar },
              { id: 'classes', label: 'Classes', icon: LayoutDashboard },
              { id: 'institutes', label: 'Institutes', icon: School },
              { id: 'requests', label: 'Requests', icon: Repeat },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-6 py-4 rounded-[1.8rem] text-[11px] font-black transition-all uppercase tracking-widest ${
                  activeTab === tab.id 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
                    : 'text-foreground/30 hover:text-foreground hover:bg-white/5'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-10">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-40 bg-card/20 rounded-[2.5rem] border border-white/5"></div>
            ))}
          </div>
          <div className="h-96 bg-card/20 rounded-[3.5rem] border border-white/5"></div>
        </div>
      ) : (
        <div className="space-y-12">
          {activeTab === 'analytics' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-1000">
              {/* Platform Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                {[
                  { id: 'institutes', label: 'Institutes', count: institutes.length, icon: School, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { id: 'users', label: 'Users', count: analytics.totalUsers, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
                  { id: 'classes', label: 'Classes', count: analytics.totalClasses, icon: LayoutDashboard, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { id: 'events', label: 'Events', count: analytics.totalEvents, icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                  { id: 'subjects', label: 'Subjects', count: analytics.totalSubjects, icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                  { id: 'tasks', label: 'Tasks', count: analytics.totalTasks, icon: ListTodo, color: 'text-rose-400', bg: 'bg-rose-400/10' },
                  { id: 'posts', label: 'Updates', count: analytics.totalPosts, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-400/10' }
                ].map(stat => (
                  <div 
                    key={stat.id} 
                    className={`group relative overflow-hidden bg-card/20 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 transition-all duration-500 hover:scale-[1.05] hover:border-primary/30 hover:shadow-2xl cursor-pointer ${activeDetailTab === stat.id ? 'border-primary/50 bg-primary/5' : ''}`}
                    onClick={() => setActiveDetailTab(activeDetailTab === stat.id ? null : stat.id as any)}
                  >
                    <div className="flex flex-col gap-6 relative z-10">
                      <div className={`h-12 w-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-4xl font-black tracking-tighter leading-none mb-2 italic">{stat.count}</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">{stat.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Intelligence Dropdown */}
              {activeDetailTab && (
                <div className="animate-in zoom-in-95 fade-in duration-500">
                   <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-[3.5rem] p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
                        <div className="space-y-2">
                           <h3 className="text-3xl font-black tracking-tighter italic uppercase text-primary">Detailed Records</h3>
                           <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 italic">Collection: {activeDetailTab.toUpperCase()}</p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                           <div className="relative group">
                             <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20 group-focus-within:opacity-100 transition-opacity" />
                             <input 
                               type="text" 
                               placeholder="Search..." 
                               value={searchTerm}
                               onChange={(e) => setSearchTerm(e.target.value)}
                               className="h-14 w-64 rounded-2xl bg-white/5 border border-white/10 pl-14 pr-6 text-xs font-bold uppercase tracking-widest italic outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                             />
                           </div>
                           <Button variant="ghost" className="rounded-2xl h-14 w-14 p-0 text-danger hover:bg-danger/10" onClick={() => setActiveDetailTab(null)}>
                             <XCircle className="h-6 w-6" />
                           </Button>
                        </div>
                      </div>

                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-h-[600px] overflow-y-auto no-scrollbar pr-4">
                        {/* List Items (Refactored for Nexus Theme) */}
                        {activeDetailTab === 'users' && allUsers.filter(u => !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                          <div key={u.id} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 group hover:border-primary/40 transition-all cursor-pointer" onClick={() => setSelectedUser(u)}>
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center font-black italic text-primary text-xl">
                                {u.name?.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black italic truncate uppercase">{u.name}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary mt-1">{u.role}</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {activeDetailTab === 'classes' && classes.filter(c => !searchTerm || c.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                          <div key={c.id} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 group hover:border-emerald-400/40 transition-all cursor-pointer" onClick={() => openClassDetails(c)}>
                            <div className="flex justify-between items-start mb-4">
                              <p className="text-sm font-black italic truncate uppercase">{c.name}</p>
                              <span className="text-[10px] font-black bg-emerald-400/20 text-emerald-400 px-3 py-1 rounded-full">{c.joinCode}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Users className="h-4 w-4 opacity-20" />
                              <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Active Cluster</span>
                            </div>
                          </div>
                        ))}
                        
                        {/* Add more as needed, following the same premium pattern */}
                        {['institutes', 'events', 'subjects'].includes(activeDetailTab) && (
                          <div className="col-span-full py-20 text-center">
                            <Activity className="h-16 w-16 mx-auto opacity-10 mb-4 animate-pulse" />
                            <p className="text-xs font-black uppercase tracking-[0.4em] opacity-20 italic">Loading Data...</p>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              )}


                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[3rem] p-10 shadow-xl group">
                    <div className="flex items-center justify-between mb-10">
                      <div>
                        <h3 className="text-2xl font-black tracking-tight italic uppercase">User Growth</h3>
                        <p className="text-[11px] text-foreground/40 font-bold uppercase tracking-widest mt-1">Growth over time</p>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-black uppercase tracking-widest">
                        <TrendingUp className="h-4 w-4" /> Growth
                      </div>
                    </div>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.userGrowth}>
                          <defs>
                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="date" hide />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              borderRadius: '2rem', 
                              border: '1px solid hsl(var(--border))',
                              boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.2)',
                              padding: '1rem'
                            }} 
                          />
                          <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={5} fillOpacity={1} fill="url(#colorUsers)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[3rem] p-10 shadow-xl">
                    <div className="flex items-center justify-between mb-10">
                      <div>
                        <h3 className="text-2xl font-black tracking-tight italic uppercase">Data Distribution</h3>
                        <p className="text-[11px] text-foreground/40 font-bold uppercase tracking-widest mt-1">Data weight by category</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-2xl">
                        <Globe className="h-6 w-6 text-foreground/20" />
                      </div>
                    </div>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Classes', value: analytics.totalClasses },
                              { name: 'Events', value: analytics.totalEvents },
                              { name: 'Updates', value: analytics.totalPosts },
                              { name: 'Subjects', value: analytics.totalSubjects },
                            ]}
                            innerRadius={90}
                            outerRadius={125}
                            paddingAngle={10}
                            dataKey="value"
                            stroke="none"
                          >
                            {CHART_COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight italic uppercase">Event Verification</h2>
                    <p className="text-[11px] text-foreground/40 font-black uppercase tracking-widest mt-1">Review and authenticate community submissions</p>
                  </div>
                </div>

                {pendingEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-24 border-2 border-dashed border-border/50 rounded-[3.5rem] bg-card/20 text-center">
                    <div className="p-8 bg-success/10 rounded-[2.5rem] mb-6">
                      <CheckCircle className="h-16 w-16 text-success opacity-40" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight mb-2 italic uppercase">Zero Backlog</h3>
                    <p className="text-sm text-foreground/40 font-medium">Platform content is fully authenticated.</p>
                  </div>
                ) : (
                  <div className="grid gap-8 md:grid-cols-2">
                    {pendingEvents.map(event => (
                      <div 
                        key={event.id} 
                        className="group bg-card/40 backdrop-blur-md border border-border/50 rounded-[3rem] p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em]">
                            {event.category}
                          </div>
                          <div className="text-[10px] font-black text-foreground/20 uppercase tracking-widest group-hover:text-foreground transition-colors">
                            {new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-4 italic group-hover:text-primary transition-colors leading-tight">{event.title}</h3>
                        <p className="text-sm text-foreground/60 mb-8 line-clamp-2 leading-relaxed font-medium">{event.description}</p>
                        
                        <div className="flex items-center gap-4 mb-8">
                          <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-sm font-black group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {event.organizer.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black italic">{event.organizer}</p>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest mt-0.5">Author</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <Button 
                            className="rounded-2xl h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black italic uppercase tracking-widest shadow-xl shadow-emerald-500/20"
                            onClick={(e) => { e.stopPropagation(); approveEvent(event.id); }}
                          >
                            Approve
                          </Button>
                          <Button 
                            className="rounded-2xl h-14 bg-rose-500 hover:bg-rose-600 text-white font-black italic uppercase tracking-widest shadow-xl shadow-rose-500/20"
                            onClick={(e) => { e.stopPropagation(); rejectEvent(event.id); }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'institutes' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight italic uppercase">CAMPUS DIRECTORY</h2>
                    <p className="text-[11px] text-foreground/40 font-black uppercase tracking-widest mt-1">Institutional management & domain security</p>
                  </div>
                  <Button onClick={() => setIsInstituteModalOpen(true)} className="gap-2 rounded-[1.5rem] h-14 px-8 font-black italic uppercase tracking-widest shadow-2xl shadow-primary/30">
                    <Plus className="h-5 w-5" /> Onboard Campus
                  </Button>
                </div>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {institutes.map(inst => (
                    <div key={inst.id} className="group bg-card/40 backdrop-blur-md border border-border/50 rounded-[3rem] p-10 hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2">
                      <div className="flex items-start justify-between mb-8">
                        <div className="p-5 bg-primary/10 rounded-[2rem] group-hover:bg-primary/20 transition-all group-hover:rotate-6">
                          <School className="h-10 w-10 text-primary" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="rounded-2xl h-10 w-10 p-0" onClick={() => { setEditingInstitute(inst); setNewInstName(inst.name); setNewInstDomains(inst.domains.join(', ')); setIsInstituteModalOpen(true); }}><Edit2 className="h-5 w-5 opacity-40" /></Button>
                          <Button variant="ghost" size="sm" className="rounded-2xl h-10 w-10 p-0 text-danger hover:bg-danger/10" onClick={() => deleteInstitute(inst.id)}><Trash2 className="h-5 w-5 opacity-40" /></Button>
                        </div>
                      </div>
                      
                      <h3 className="font-black text-3xl tracking-tight mb-3 italic group-hover:text-primary transition-colors leading-none">{inst.name}</h3>
                      
                      <div className="flex flex-wrap gap-2 mt-6">
                        {inst.domains.map(domain => (
                          <span key={domain} className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/5 text-accent text-[11px] font-black uppercase tracking-widest border border-accent/20 group-hover:bg-accent/10 transition-colors">
                            <Globe className="h-3.5 w-3.5" /> {domain}
                          </span>
                        ))}
                      </div>

                      <div className="mt-10 pt-8 border-t border-border/30 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] text-foreground/30 font-black uppercase tracking-[0.2em]">Live Enclaves</p>
                          <p className="text-4xl font-black text-primary italic leading-none">
                            {classes.filter(c => c.instituteId === inst.id).length}
                          </p>
                        </div>
                        <div className="h-14 w-14 rounded-[1.5rem] bg-muted/30 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                          <Users className="h-6 w-6 text-foreground/10 group-hover:text-primary/30 transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'classes' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight italic uppercase">Academic Segments</h2>
                    <p className="text-[11px] text-foreground/40 font-black uppercase tracking-widest mt-1">Configure sections and enrollment architecture</p>
                  </div>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 rounded-[1.5rem] h-14 px-8 font-black italic uppercase tracking-widest shadow-2xl shadow-primary/30">
                    <Plus className="h-5 w-5" /> New Section
                  </Button>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {classes.map(cls => {
                    const inst = institutes.find(i => i.id === cls.instituteId);
                    const strength = allUsers.filter(u => u.classId === cls.id).length;
                    return (
                      <div 
                        key={cls.id} 
                        className="group bg-card/40 backdrop-blur-md border border-border/50 rounded-[2.5rem] p-8 hover:border-primary/50 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col"
                        onClick={() => openClassDetails(cls)}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-4 bg-accent/10 rounded-2xl group-hover:bg-accent/20 transition-colors">
                            <BookOpen className="h-6 w-6 text-accent" />
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest mb-1 italic">
                              {cls.joinCode}
                            </span>
                            <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-tighter">Join Key</span>
                          </div>
                        </div>

                        <h3 className="font-black text-xl tracking-tight mb-1 italic group-hover:text-primary transition-colors line-clamp-1">{cls.name}</h3>
                        <p className="text-[10px] text-foreground/40 font-black uppercase tracking-[0.15em] mb-8">{inst?.name || 'External Unit'}</p>
                        
                        <div className="mt-auto pt-6 border-t border-border/50 flex items-center justify-between">
                          <div className="flex -space-x-3">
                            {[...Array(Math.min(strength, 4))].map((_, i) => (
                              <div key={i} className="h-8 w-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-black text-foreground/40">U</div>
                            ))}
                            {strength > 4 && <div className="h-8 w-8 rounded-full border-2 border-card bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-black">+{strength - 4}</div>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="rounded-xl hover:bg-danger/10 text-danger" onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight italic uppercase">Operations Log</h2>
                    <p className="text-[11px] text-foreground/40 font-black uppercase tracking-widest mt-1">Processing pending infrastructure requests</p>
                  </div>
                </div>

                {changeRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-24 border-2 border-dashed border-border/50 rounded-[3.5rem] bg-card/20 text-center">
                    <div className="p-8 bg-primary/10 rounded-[2.5rem] mb-6">
                      <Repeat className="h-16 w-16 text-primary opacity-40" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight mb-2 italic uppercase">System Stable</h3>
                    <p className="text-sm text-foreground/40 font-medium">No pending transfer requests or configuration logs.</p>
                  </div>
                ) : (
                  <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {changeRequests.map(req => (
                      <div key={req.id} className="group bg-card/40 backdrop-blur-md border border-primary/20 rounded-[3rem] p-10 shadow-2xl shadow-primary/5">
                        <div className="flex items-center gap-5 mb-8">
                          <div className="h-16 w-16 rounded-[2rem] bg-primary/20 flex items-center justify-center text-2xl font-black text-primary italic border-2 border-primary/20">
                            {req.userName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xl font-black italic tracking-tight">{req.userName}</p>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest mt-1">{new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-5 rounded-[2rem] bg-background/50 border border-border/50 mb-10 relative overflow-hidden group-hover:border-primary/30 transition-all">
                          <div className="text-center flex-1 relative z-10">
                            <p className="text-[9px] uppercase font-black text-foreground/30 mb-2 tracking-widest">Source</p>
                            <p className="text-xs font-black text-rose-500 uppercase italic line-clamp-1">{req.requestedClassName ? 'Current' : 'None'}</p>
                          </div>
                          <div className="px-4 relative z-10">
                            <div className="p-3 bg-primary/10 rounded-full animate-pulse">
                              <Repeat className="h-5 w-5 text-primary" />
                            </div>
                          </div>
                          <div className="text-center flex-1 relative z-10">
                            <p className="text-[9px] uppercase font-black text-foreground/30 mb-2 tracking-widest">Target</p>
                            <p className="text-xs font-black text-emerald-500 uppercase italic line-clamp-1">{req.requestedClassName}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <Button 
                            className="rounded-2xl h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black italic uppercase tracking-widest shadow-xl shadow-emerald-500/20"
                            onClick={() => handleApproveChangeRequest(req)}
                          >
                            Execute
                          </Button>
                          <Button 
                            className="rounded-2xl h-14 border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 font-black italic uppercase tracking-widest"
                            onClick={() => handleRejectChangeRequest(req)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
          <div className="space-y-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/20 group hover:bg-primary/10 transition-all relative">
                <button 
                  className="absolute top-4 right-4 p-2 rounded-xl bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedClass.joinCode);
                    toast.success('Key Copied');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </button>
                <p className="text-[10px] uppercase font-black text-primary/40 mb-2 tracking-widest">Campus Key</p>
                <p className="text-3xl font-black font-mono text-primary italic">{selectedClass.joinCode}</p>
              </div>
              <div className="p-6 rounded-[2rem] bg-accent/5 border border-accent/20 group hover:bg-accent/10 transition-all relative">
                <button 
                  className="absolute top-4 right-4 p-2 rounded-xl bg-accent/10 text-accent opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedClass.adminInviteCode);
                    toast.success('ID Copied');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </button>
                <p className="text-[10px] uppercase font-black text-accent/40 mb-2 tracking-widest">Privilege ID</p>
                <p className="text-3xl font-black font-mono text-accent italic">{selectedClass.adminInviteCode}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="px-4 py-1.5 rounded-full bg-foreground/5 text-[11px] font-black uppercase tracking-widest border border-border/50">Y: {selectedClass.year || 'X'}</div>
              <div className="px-4 py-1.5 rounded-full bg-foreground/5 text-[11px] font-black uppercase tracking-widest border border-border/50">P: {selectedClass.program || 'GEN'}</div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-black italic uppercase tracking-tight flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" /> Active Cohort ({classStudents.length})
                </h4>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {classStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-border/50 group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-[10px] font-black">{student.name.charAt(0)}</div>
                      <span className="text-sm font-black italic">{student.name}</span>
                    </div>
                    <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${student.role === 'admin' ? 'bg-rose-500 text-white' : 'bg-primary/10 text-primary'}`}>{student.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-black italic uppercase tracking-tight flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-accent" /> Curriculum Map ({classSubjects.length})
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] font-black uppercase italic gap-2 hover:bg-accent/10 text-accent"
                  onClick={() => {
                    setSubjectForm({ classId: selectedClass.id, type: 'theory', isActive: true });
                    setIsEditingSubject(true);
                  }}
                >
                  <Plus className="h-3 w-3" /> Add Unit
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {classSubjects.map(sub => (
                  <div key={sub.id} className="p-4 rounded-2xl bg-card/40 border border-border/50 group hover:border-accent/30 transition-all flex justify-between items-start">
                    <div>
                      <span className="font-black text-accent opacity-50 block text-[10px] tracking-widest uppercase mb-1">{sub.code}</span>
                      <span className="font-black italic text-sm leading-tight">{sub.name}</span>
                      <span className="block text-[9px] text-foreground/30 font-bold uppercase mt-1">CR: {sub.credits || 0}</span>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setSubjectForm(sub); setIsEditingSubject(true); }}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-danger" onClick={() => handleDeleteSubject(sub.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 flex gap-4">
              <Button className="flex-1 rounded-2xl h-14 font-black italic uppercase tracking-widest" onClick={() => { setEditingClass(selectedClass); setSelectedClass(null); }}>Edit Core</Button>
              <Button variant="outline" className="flex-1 rounded-2xl h-14 border-danger/20 text-danger hover:bg-danger/5 font-black italic uppercase tracking-widest" onClick={() => { handleDeleteClass(selectedClass); setSelectedClass(null); }}>Purge Unit</Button>
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
        isAdminView={true}
      />

      {/* Institute Modal */}
      <Modal
        isOpen={isInstituteModalOpen}
        onClose={() => { setIsInstituteModalOpen(false); setEditingInstitute(null); setNewInstName(''); setNewInstDomains(''); }}
        title={editingInstitute ? 'Edit Campus Profile' : 'Initiate New Campus'}
      >
        <form onSubmit={handleInstituteAction} className="space-y-6 py-6">
          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-widest text-foreground/40 ml-1">Official Name</label>
            <Input 
              placeholder="e.g. GLA UNIVERSITY CAMPUS" 
              value={newInstName}
              onChange={e => setNewInstName(e.target.value)}
              required
              className="h-14 rounded-2xl bg-muted/20 border-none focus:ring-2 focus:ring-primary/40 font-black italic"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-widest text-foreground/40 ml-1">Secure Email Enclaves</label>
            <textarea
              placeholder="gla.ac.in, gla.in (comma separated)"
              className="flex w-full rounded-2xl border-none bg-muted/20 px-4 py-4 text-sm font-black italic text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 min-h-[120px]"
              value={newInstDomains}
              onChange={e => setNewInstDomains(e.target.value)}
              required
            />
            <p className="text-[10px] text-foreground/30 italic px-1 font-medium">Verify domains carefully. These control student access gates.</p>
          </div>
          <div className="pt-8 flex gap-4">
            <Button type="button" variant="ghost" className="flex-1 rounded-2xl h-14 font-black italic uppercase tracking-widest" onClick={() => setIsInstituteModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1 rounded-2xl h-14 font-black italic uppercase tracking-widest shadow-xl shadow-primary/20" disabled={loading}>
              {editingInstitute ? 'Update Enclave' : 'Seal & Deploy'}
            </Button>
          </div>
        </form>
      </Modal>
      {/* User Detail Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Intelligence"
      >
        {selectedUser && (
          <div className="space-y-8 py-6">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-[2rem] bg-primary/10 flex items-center justify-center text-3xl font-black italic text-primary">
                {selectedUser.name?.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight italic uppercase">{selectedUser.name}</h3>
                <p className="text-xs text-foreground/40 font-black tracking-widest uppercase mt-1">{selectedUser.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-muted/20 border border-border/50">
                <p className="text-[10px] font-black uppercase text-foreground/30 mb-2">Program Node</p>
                <p className="text-sm font-black italic">{selectedUser.program || 'N/A'}</p>
              </div>
              <div className="p-5 rounded-3xl bg-muted/20 border border-border/50">
                <p className="text-[10px] font-black uppercase text-foreground/30 mb-2">Year Cycle</p>
                <p className="text-sm font-black italic">{selectedUser.role || 'N/A'}</p>
              </div>
              <div className="p-5 rounded-3xl bg-muted/20 border border-border/50">
                <p className="text-[10px] font-black uppercase text-foreground/30 mb-2">Branch sector</p>
                <p className="text-sm font-black italic">{selectedUser.branch || 'N/A'}</p>
              </div>
              <div className="p-5 rounded-3xl bg-muted/20 border border-border/50">
                <p className="text-[10px] font-black uppercase text-foreground/30 mb-2">Trust Score</p>
                <p className="text-sm font-black italic text-success">{selectedUser.trustScore || 100}%</p>
              </div>
            </div>

            <div className="pt-6">
              <Button 
                variant="outline" 
                className="w-full rounded-2xl h-14 border-danger/20 text-danger hover:bg-danger/5 font-black italic uppercase tracking-widest"
                onClick={() => { toast.error('Moderation Actions Restricted'); }}
              >
                Restrict Access
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Subject Detail & Edit Modal */}
      <Modal
        isOpen={!!selectedSubject || isEditingSubject}
        onClose={() => { setSelectedSubject(null); setIsEditingSubject(false); setSubjectForm({}); }}
        title={isEditingSubject ? (subjectForm.id ? 'Edit Academic Unit' : 'Configure New Unit') : 'Unit Specification'}
      >
        {(selectedSubject || isEditingSubject) && (
          <div className="space-y-8 py-6">
            {isEditingSubject ? (
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveSubject(); }}>
                <div className="space-y-4">
                  <Input 
                    label="Unit Name"
                    value={subjectForm.name || ''}
                    onChange={e => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Data Structures"
                    required
                  />
                  <Input 
                    label="Course Code"
                    value={subjectForm.code || ''}
                    onChange={e => setSubjectForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. CS101"
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-foreground/40 ml-1">Credits</label>
                      <Input 
                        type="number"
                        step="0.5"
                        min="0"
                        value={subjectForm.credits?.toString() || ''}
                        onChange={e => setSubjectForm(prev => ({ ...prev, credits: parseFloat(e.target.value) || 0 }))}
                        placeholder="e.g. 4.0"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-foreground/40 ml-1">Type</label>
                      <select
                        className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-black italic"
                        value={subjectForm.type}
                        onChange={e => setSubjectForm(prev => ({ ...prev, type: e.target.value as any }))}
                      >
                        <option value="theory">Theory</option>
                        <option value="lab">Laboratory</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="pt-6 flex gap-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsEditingSubject(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 shadow-xl shadow-primary/20">Save Unit</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-8">
                <div className="p-6 rounded-[2.5rem] bg-accent/5 border border-accent/20">
                  <span className="text-xs font-black text-accent uppercase tracking-[0.3em] block mb-3">{selectedSubject?.code}</span>
                  <h3 className="text-3xl font-black tracking-tighter italic uppercase leading-tight">{selectedSubject?.name}</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-3xl bg-muted/20 border border-border/50 flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase text-foreground/30">Unit Classification</p>
                    <p className="text-sm font-black italic uppercase">{selectedSubject?.type}</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-muted/20 border border-border/50 flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase text-foreground/30">Academic Credits</p>
                    <p className="text-sm font-black italic">{selectedSubject?.credits || '0.0'}</p>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <Button variant="ghost" className="flex-1 rounded-2xl h-14 font-black italic uppercase tracking-widest" onClick={() => setSelectedSubject(null)}>Close</Button>
                  <Button 
                    className="flex-1 rounded-2xl h-14 font-black italic uppercase tracking-widest shadow-xl shadow-accent/20"
                    onClick={() => { if (selectedSubject) { setSubjectForm(selectedSubject); setIsEditingSubject(true); setSelectedSubject(null); } }}
                  >
                    Edit Unit
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
