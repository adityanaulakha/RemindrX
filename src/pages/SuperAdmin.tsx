import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Event, ClassData, User, Subject } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CreateSectionModal } from '../components/CreateSectionModal';
import { EditSectionModal } from '../components/EditSectionModal';
import { Calendar, CheckCircle, XCircle, Users, BookOpen, LayoutDashboard, Search, ListTodo, MessageSquare, TrendingUp, Trophy, Plus, Edit2, Trash2, Repeat } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
  const { userData } = useAuth();
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [crMap, setCrMap] = useState<Record<string, string>>({}); // userId -> name
  const [analytics, setAnalytics] = useState<Analytics>({ 
    totalUsers: 0, totalClasses: 0, totalEvents: 0, totalSubjects: 0, totalTasks: 0, totalPosts: 0 
  });
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [classDetailsLoading, setClassDetailsLoading] = useState(false);
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);

  // Class Change Requests
  const [changeRequests, setChangeRequests] = useState<ClassChangeRequest[]>([]);

  useEffect(() => {
    if (!userData?.isSuperAdmin) return;

    const fetchData = async () => {
      try {
        // Fetch Analytics
        const [
          usersSnap, classesSnap, eventsSnap, subjectsSnap, tasksSnap, postsSnap
        ] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'classes')),
          getCountFromServer(collection(db, 'events')),
          getCountFromServer(collection(db, 'subjects')),
          getCountFromServer(collection(db, 'tasks')),
          getCountFromServer(collection(db, 'posts')),
        ]);
        
        setAnalytics({
          totalUsers: usersSnap.data().count,
          totalClasses: classesSnap.data().count,
          totalEvents: eventsSnap.data().count,
          totalSubjects: subjectsSnap.data().count,
          totalTasks: tasksSnap.data().count,
          totalPosts: postsSnap.data().count,
        });

        // Fetch Top Contributors
        try {
          // If this query fails due to missing index, we catch it silently for now, or it will log
          const topQ = query(collection(db, 'users'), where('trustScore', '>=', 0));
          const topSnap = await getDocs(topQ);
          // Manually sort since we don't want to enforce a complex index right now if not available
          let allUsers = topSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
          allUsers.sort((a, b) => b.trustScore - a.trustScore);
          setTopUsers(allUsers.slice(0, 5));
        } catch (e) {
          console.error("Failed to fetch top users", e);
        }

        // Fetch Classes
        const fetchClassesData = async () => {
          const clsSnap = await getDocs(collection(db, 'classes'));
          const fetchedClasses = clsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassData));
          setClasses(fetchedClasses);
        };
        await fetchClassesData();

        // Save reference for refreshing later
        (window as any).refreshClasses = fetchClassesData;

        // Fetch CRs (users with role 'admin')
        const adminQ = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminSnap = await getDocs(adminQ);
        const map: Record<string, string> = {};
        adminSnap.docs.forEach(d => {
          map[d.id] = d.data().name;
        });
        setCrMap(map);

        // Fetch Class Change Requests
        const fetchChangeRequests = () => {
          const reqQ = query(collection(db, 'class_change_requests'), where('status', '==', 'pending'));
          return onSnapshot(reqQ, (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassChangeRequest));
            setChangeRequests(reqs.sort((a, b) => b.createdAt - a.createdAt));
          });
        };
        const unsubReqs = fetchChangeRequests();

        return () => {
          if (unsubReqs) unsubReqs();
        };

      } catch (err) {
        console.error("Error fetching analytics data", err);
      }
    };

    fetchData();

    // Listen to pending events
    const q = query(collection(db, 'events'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      fetched.sort((a, b) => a.date - b.date);
      setPendingEvents(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleAction = async (eventId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'events', eventId), { status });
      toast.success(`Event ${status}!`);
    } catch (error) {
      toast.error('Failed to update event status');
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
        if ((window as any).refreshClasses) {
          (window as any).refreshClasses();
        }
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <Users className="h-5 w-5 text-primary mb-2" />
                <h3 className="text-3xl font-black text-primary">{analytics.totalUsers}</h3>
                <p className="text-xs font-medium text-primary/80 mt-1 uppercase tracking-wider">Users</p>
              </CardContent>
            </Card>

            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <LayoutDashboard className="h-5 w-5 text-accent mb-2" />
                <h3 className="text-3xl font-black text-accent">{analytics.totalClasses}</h3>
                <p className="text-xs font-medium text-accent/80 mt-1 uppercase tracking-wider">Classes</p>
              </CardContent>
            </Card>

            <Card className="bg-success/5 border-success/20">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <Calendar className="h-5 w-5 text-success mb-2" />
                <h3 className="text-3xl font-black text-success">{analytics.totalEvents}</h3>
                <p className="text-xs font-medium text-success/80 mt-1 uppercase tracking-wider">Events</p>
              </CardContent>
            </Card>

            <Card className="bg-warning/5 border-warning/20">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <BookOpen className="h-5 w-5 text-warning mb-2" />
                <h3 className="text-3xl font-black text-warning">{analytics.totalSubjects}</h3>
                <p className="text-xs font-medium text-warning/80 mt-1 uppercase tracking-wider">Subjects</p>
              </CardContent>
            </Card>

            <Card className="bg-danger/5 border-danger/20">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <ListTodo className="h-5 w-5 text-danger mb-2" />
                <h3 className="text-3xl font-black text-danger">{analytics.totalTasks}</h3>
                <p className="text-xs font-medium text-danger/80 mt-1 uppercase tracking-wider">Tasks</p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <MessageSquare className="h-5 w-5 text-primary mb-2" />
                <h3 className="text-3xl font-black text-primary">{analytics.totalPosts}</h3>
                <p className="text-xs font-medium text-primary/80 mt-1 uppercase tracking-wider">Updates</p>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard & Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <Trophy className="h-5 w-5 text-accent" />
                <CardTitle>Top Contributors</CardTitle>
              </CardHeader>
              <CardContent>
                {topUsers.length === 0 ? (
                  <p className="text-center text-sm text-foreground/50 py-4">No active contributors yet.</p>
                ) : (
                  <div className="space-y-3 mt-2">
                    {topUsers.map((user, index) => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${
                            index === 0 ? 'bg-warning/20 text-warning' : 
                            index === 1 ? 'bg-foreground/20 text-foreground/70' : 
                            index === 2 ? 'bg-accent/20 text-accent/70' : 
                            'bg-primary/10 text-primary'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{user.name}</p>
                            <p className="text-xs text-foreground/50">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-accent">{user.trustScore}</p>
                          <p className="text-[10px] text-foreground/50 uppercase tracking-wider">Score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Class Change Requests */}
            {changeRequests.length > 0 && (
              <Card className="border-warning/50">
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2 bg-warning/5 border-b border-warning/10">
                  <Repeat className="h-5 w-5 text-warning" />
                  <CardTitle>Pending Transfers ({changeRequests.length})</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {changeRequests.map((req) => {
                      const currentClass = classes.find(c => c.id === req.currentClassId);
                      return (
                        <div key={req.id} className="p-3 rounded-lg bg-card border border-border flex flex-col gap-3">
                          <div>
                            <p className="text-sm font-bold">{req.userName}</p>
                            <p className="text-xs text-foreground/60 mt-1">
                              Current: <strong className="text-foreground">{currentClass?.name || 'Unknown'}</strong>
                            </p>
                            <p className="text-xs text-foreground/60">
                              Requested: <strong className="text-primary">{req.requestedClassName}</strong> ({req.requestedClassCode})
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="w-full bg-success hover:bg-success/90 text-white" onClick={() => handleApproveChangeRequest(req)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="w-full border-danger/50 text-danger hover:bg-danger/10" onClick={() => handleRejectChangeRequest(req)}>
                              Reject
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" /> Platform Averages
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium text-foreground/70">Average Class Size</span>
                    <span className="text-2xl font-bold">{analytics.totalClasses ? Math.round(analytics.totalUsers / analytics.totalClasses) : 0}</span>
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-1/2 rounded-full"></div>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">Students per active section</p>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium text-foreground/70">Adoption Rate</span>
                    <span className="text-2xl font-bold">
                      {analytics.totalUsers ? Math.round((Object.keys(crMap).length / analytics.totalUsers) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${analytics.totalUsers ? Math.round((Object.keys(crMap).length / analytics.totalUsers) * 100) : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-foreground/50 mt-2">Percentage of users who are Class Representatives</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sections Directory */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Sections Directory</h2>
            <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Create Section
            </Button>
          </div>
          <div className="space-y-3">
            {classes.length === 0 ? (
              <p className="text-foreground/50">No classes registered yet.</p>
            ) : (
              classes.map(cls => (
                <Card key={cls.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-lg leading-tight mb-1">{cls.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {cls.program && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/10 text-primary">{cls.program}</span>}
                        {cls.branch && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-accent/10 text-accent">{cls.branch}</span>}
                        {cls.year && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-foreground/10 text-foreground/70">Year {cls.year}</span>}
                        {cls.section && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-foreground/10 text-foreground/70">Sec {cls.section}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-foreground/60">
                        <span>Code: <strong className="text-foreground font-mono">{cls.joinCode}</strong></span>
                        <span>CRs: {cls.admins.map(id => crMap[id] || 'Unknown').join(', ') || 'None'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openClassDetails(cls)}>
                        <Search className="h-4 w-4" /> 
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingClass(cls)}>
                        <Edit2 className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteClass(cls)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Pending Events Moderation */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Moderation Queue</h2>
            {pendingEvents.length > 0 && (
              <span className="bg-warning text-warning-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingEvents.length} Pending
              </span>
            )}
          </div>
          
          <div className="space-y-3">
            {pendingEvents.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-foreground/60 mt-1">There are no pending event requests.</p>
              </div>
            ) : (
              pendingEvents.map(event => (
                <Card key={event.id} className="border-warning/30 bg-warning/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-warning"></div>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-warning/20 text-warning">
                            {event.category}
                          </span>
                          <span className="text-xs text-foreground/50">By {event.organizer}</span>
                        </div>
                        <h4 className="font-bold text-lg leading-tight">{event.title}</h4>
                        <p className="text-sm text-foreground/70 line-clamp-2 mt-1">{event.description}</p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Button 
                          size="sm"
                          onClick={() => handleAction(event.id, 'approved')}
                          className="bg-primary/20 text-primary hover:bg-primary hover:text-white border-none flex-1"
                        >
                          <CheckCircle className="mr-1.5 h-4 w-4" /> Approve
                        </Button>
                        <Button 
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction(event.id, 'rejected')}
                          className="bg-danger/10 text-danger hover:bg-danger hover:text-white border-none flex-1"
                        >
                          <XCircle className="mr-1.5 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section Details Modal */}
      <Modal isOpen={!!selectedClass} onClose={() => setSelectedClass(null)} title={`Section Details: ${selectedClass?.name}`}>
        {classDetailsLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-background rounded-lg"></div>
            <div className="h-24 bg-background rounded-lg"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" /> Students ({classStudents.length})
              </h3>
              <div className="bg-background rounded-lg border border-border p-1 max-h-48 overflow-y-auto">
                {classStudents.length === 0 ? <p className="p-3 text-sm text-foreground/50">No students enrolled.</p> : (
                  <ul className="divide-y divide-border">
                    {classStudents.map(student => (
                      <li key={student.id} className="p-3 flex items-center justify-between text-sm">
                        <span>{student.name}</span>
                        <span className="text-xs text-foreground/50 capitalize">{student.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                <BookOpen className="h-5 w-5 text-accent" /> Subjects ({classSubjects.length})
              </h3>
              <div className="bg-background rounded-lg border border-border p-1 max-h-48 overflow-y-auto">
                {classSubjects.length === 0 ? <p className="p-3 text-sm text-foreground/50">No subjects added.</p> : (
                  <ul className="divide-y divide-border">
                    {classSubjects.map(sub => (
                      <li key={sub.id} className="p-3 flex items-center justify-between text-sm">
                        <span>{sub.name} <span className="text-foreground/50 ml-1">({sub.code})</span></span>
                        <span className="text-[10px] uppercase font-bold bg-accent/10 text-accent px-2 py-0.5 rounded">{sub.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <CreateSectionModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSectionCreated={() => {
          if ((window as any).refreshClasses) {
            (window as any).refreshClasses();
          }
        }}
      />

      <EditSectionModal
        isOpen={!!editingClass}
        onClose={() => setEditingClass(null)}
        section={editingClass}
        onSectionUpdated={() => {
          if ((window as any).refreshClasses) {
            (window as any).refreshClasses();
          }
        }}
      />
    </div>
  );
}
