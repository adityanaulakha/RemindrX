import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Task } from '../types';
import { TaskModal } from '../components/TaskModal';
import { Button } from '../components/ui/Button';
import { Plus, Clock, Calendar, AlertTriangle } from 'lucide-react';

export default function Timeline() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!userData?.classId) return;

    // Use onSnapshot for real-time updates as requested in performance requirements
    const q = query(
      collection(db, 'tasks'),
      where('classId', '==', userData.classId),
      orderBy('deadline', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(fetchedTasks);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks in real-time:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const now = Date.now();

  const isPast = (deadline: number) => deadline < now;
  const isCritical = (deadline: number, priority: string) => !isPast(deadline) && (deadline <= now + 48 * 60 * 60 * 1000 || priority === 'critical');

  if (loading) {
    return <div className="animate-pulse h-64 bg-card rounded-xl"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timeline</h1>
          <p className="text-foreground/60">All your upcoming deadlines.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Task
        </Button>
      </div>

      <div className="relative border-l-2 border-border/50 pl-6 space-y-8 mt-8 ml-4">
        {tasks.length === 0 ? (
          <p className="text-foreground/50">No tasks found. Everything is clear!</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className={`relative ${isPast(task.deadline) ? 'opacity-50' : ''}`}>
              {/* Timeline Dot */}
              <div className={`absolute -left-[33px] flex h-4 w-4 items-center justify-center rounded-full border-4 border-background ${
                isPast(task.deadline) ? 'bg-border' : 
                isCritical(task.deadline, task.priority) ? 'bg-danger' : 'bg-primary'
              }`} />

              <div className={`rounded-xl border p-5 shadow-sm transition-all ${
                isCritical(task.deadline, task.priority) && !isPast(task.deadline)
                  ? 'border-danger/30 bg-danger/5 hover:border-danger/50' 
                  : 'border-border bg-card hover:border-primary/50'
              }`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${
                        task.priority === 'critical' ? 'bg-danger/20 text-danger' :
                        task.priority === 'medium' ? 'bg-accent/20 text-accent' :
                        'bg-foreground/10 text-foreground/70'
                      }`}>
                        {task.priority}
                      </span>
                      {isCritical(task.deadline, task.priority) && !isPast(task.deadline) && (
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
          ))
        )}
      </div>

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
