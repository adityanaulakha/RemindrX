import { useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Bell, Clock } from 'lucide-react';

export function AutoReminder() {
  const { userData, currentUser } = useAuth();

  useEffect(() => {
    if (!userData?.classId || !currentUser) return;

    const checkReminders = async () => {
      try {
        const now = Date.now();
        const tomorrow = now + 24 * 60 * 60 * 1000;
        
        // 1. Check Tasks
        const tasksQ = query(
          collection(db, 'tasks'),
          where('classId', '==', userData.classId),
          where('deadline', '>', now),
          where('deadline', '<=', tomorrow)
        );
        
        // 2. Check Events
        const eventsQ = query(
          collection(db, 'events'),
          where('status', '==', 'approved'),
          where('date', '>', now),
          where('date', '<=', tomorrow)
        );

        const [tasksSnap, eventsSnap] = await Promise.all([
          getDocs(tasksQ),
          getDocs(eventsQ)
        ]);

        const upcomingTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const upcomingEvents = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Show reminders for tasks not yet acknowledged in this session
        upcomingTasks.forEach((task: any) => {
          const key = `reminder_task_${task.id}_${new Date().toDateString()}`;
          if (!localStorage.getItem(key)) {
            toast((t) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary">
                  <Clock className="h-4 w-4" />
                  <span className="font-bold uppercase tracking-tight text-xs italic">Upcoming Deadline</span>
                </div>
                <span className="font-bold text-sm">{task.title}</span>
                <span className="text-xs opacity-70">Due within 24 hours!</span>
                <button 
                  onClick={() => toast.dismiss(t.id)}
                  className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Acknowledge
                </button>
              </div>
            ), { duration: 10000, icon: '📅' });
            localStorage.setItem(key, 'shown');
          }
        });

        // Show reminders for events
        upcomingEvents.forEach((event: any) => {
          const key = `reminder_event_${event.id}_${new Date().toDateString()}`;
          if (!localStorage.getItem(key)) {
            toast((t) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent">
                  <Bell className="h-4 w-4" />
                  <span className="font-bold uppercase tracking-tight text-xs italic">Event Tomorrow</span>
                </div>
                <span className="font-bold text-sm">{event.title}</span>
                <span className="text-xs opacity-70">Happening in the next 24 hours.</span>
              </div>
            ), { duration: 8000, icon: '🎉' });
            localStorage.setItem(key, 'shown');
          }
        });

      } catch (error) {
        console.error("Reminder check failed:", error);
      }
    };

    // Check on mount and then every hour
    checkReminders();
    const interval = setInterval(checkReminders, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userData, currentUser]);

  return null; // This component doesn't render anything visible
}
