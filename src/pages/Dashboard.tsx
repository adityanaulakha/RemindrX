import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertTriangle, Calendar, CheckCircle2, Clock, ListTodo } from 'lucide-react';

export default function Dashboard() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      if (!userData?.classId) return;
      try {
        // In a real app, we would query tasks based on the subjects that belong to this classId.
        // For simplicity and NoSQL schema design, we can query all tasks and filter client side,
        // or we need to add classId to the Task document to query it directly.
        // Assuming we update our schema to include classId on tasks for easier querying:
        const q = query(
          collection(db, 'tasks'),
          where('classId', '==', userData.classId),
          orderBy('deadline', 'asc')
        );
        const snapshot = await getDocs(q);
        const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(fetchedTasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [userData]);

  const now = Date.now();
  const fortyEightHours = 48 * 60 * 60 * 1000;

  // Filter tasks
  const dangerZoneTasks = tasks.filter(t => t.deadline > now && t.deadline <= now + fortyEightHours && t.priority === 'critical');
  const todayTasks = tasks.filter(t => {
    const d = new Date(t.deadline);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });
  const upcomingTasks = tasks.filter(t => t.deadline > now).slice(0, 5);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-card rounded-xl"></div>
      <div className="h-64 bg-card rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-foreground/60">Here is your academic overview for {new Date().toLocaleDateString()}</p>
      </div>

      {/* Danger Zone */}
      {dangerZoneTasks.length > 0 && (
        <Card className="border-danger bg-danger/5 shadow-danger/10 shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <AlertTriangle className="h-6 w-6 text-danger" />
            <CardTitle className="text-danger text-xl">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm font-medium text-danger/80">
              You have {dangerZoneTasks.length} critical {dangerZoneTasks.length === 1 ? 'task' : 'tasks'} due in the next 48 hours.
            </p>
            <div className="space-y-3">
              {dangerZoneTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between rounded-lg bg-card border border-danger/20 p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-danger/10 p-2">
                      <Clock className="h-4 w-4 text-danger" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{task.title}</p>
                      <p className="text-xs text-foreground/60">Due: {new Date(task.deadline).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">Critical</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Today's Focus</CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-foreground/50">
                <CheckCircle2 className="mb-2 h-8 w-8 opacity-20" />
                <p>No tasks due today. Enjoy your day!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-foreground/60">{new Date(task.deadline).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <ListTodo className="h-5 w-5 text-accent" />
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-foreground/50 py-4 text-center">Your schedule is clear.</p>
            ) : (
              <div className="space-y-4">
                {upcomingTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-foreground/60">{new Date(task.deadline).toLocaleDateString()}</p>
                    </div>
                    {task.priority === 'critical' && <span className="h-2 w-2 rounded-full bg-danger"></span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
