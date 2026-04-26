import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, onSnapshot, updateDoc, doc,
  limit, orderBy, writeBatch
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, LayoutDashboard, ListTodo, LogOut, Menu, X,
  ShieldAlert, CalendarRange, MessageSquare, Activity, Bell, Download,
  Sun, Moon, RotateCw, Monitor, BellOff, Info
} from 'lucide-react';
import { Button } from '../ui/Button';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { OfflineIndicator } from '../OfflineIndicator';
import { AutoReminder } from '../AutoReminder';
import { useNotifications } from '../../hooks/useNotifications';

export default function Layout() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const { isInstallable, handleInstall } = usePWAInstall();
  const { requestPermission } = useNotifications();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationLimit, setNotificationLimit] = useState(10);
  const [hasMore, setHasMore] = useState(true);

  const [refreshCooldown, setRefreshCooldown] = useState(0);

  useEffect(() => {
    // 1. Handle Refresh Cooldown
    const lastRefresh = parseInt(localStorage.getItem('last_refresh') || '0');
    const now = Date.now();
    if (now - lastRefresh < 10000) {
      setRefreshCooldown(Math.ceil((10000 - (now - lastRefresh)) / 1000));
    }

    // 2. Check if notifications are permitted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const timer = setTimeout(() => setShowNotificationPrompt(true), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    if (refreshCooldown > 0) {
      const interval = setInterval(() => setRefreshCooldown(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [refreshCooldown]);

  const handleManualRefresh = () => {
    if (refreshCooldown > 0) return;
    localStorage.setItem('last_refresh', Date.now().toString());
    setRefreshCooldown(10);
    window.dispatchEvent(new CustomEvent('app-refresh'));
  };

  useEffect(() => {
    if (!currentUser) return;

    const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000);

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('createdAt', '>=', fiveDaysAgo),
      orderBy('createdAt', 'desc'),
      limit(notificationLimit)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));
      setNotifications(fetched);
      setHasMore(fetched.length === notificationLimit);
    });

    return () => unsubscribe();
  }, [currentUser, notificationLimit]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });

    try {
      await batch.commit();
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  // Theme is now hardcoded to Dark Mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const navItems = [
    { name: 'Events', path: '/events', icon: CalendarRange },
  ];
  
  if (userData?.classId) {
    navItems.unshift(
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Subjects', path: '/subjects', icon: BookOpen },
      { name: 'Attendance', path: '/attendance', icon: Activity },
      { name: 'Timeline', path: '/timeline', icon: ListTodo },
      { name: 'Class Updates', path: '/updates', icon: MessageSquare }
    );
  }

  if (userData?.role === 'admin' && userData?.classId) {
    navItems.push({ name: 'CR Panel', path: '/cr-panel', icon: ShieldAlert });
  }

  if (userData?.isSuperAdmin) {
    navItems.push({ name: 'Super Admin', path: '/super-admin', icon: ShieldAlert });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background font-['Outfit'] selection:bg-primary/30 relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/15 rounded-full blur-[100px] opacity-40" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-success/8 rounded-full blur-[100px] opacity-40" />
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.4\'/%3E%3C/svg%3E")' }} />
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 lg:hidden animate-in fade-in duration-200" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-[70] w-72 transform transition-transform duration-300 ease-out will-change-transform lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 p-4' : '-translate-x-full lg:p-6'}`}>
        <div className="flex h-full flex-col rounded-[3rem] border border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Brand */}
          <div className="flex h-28 items-center px-8">
            <div className="flex items-center group cursor-pointer" onClick={() => navigate('/dashboard', { replace: true })}>
              <div className="relative">
                <img src="/Cropped.png" alt="Logo" className="h-16 w-auto group-hover:scale-110 transition-transform duration-500" />
              </div>
            </div>
            <button className="lg:hidden ml-auto p-3 rounded-2xl hover:bg-white/5 transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="h-6 w-6 opacity-40" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1.5 px-4 overflow-y-auto no-scrollbar py-2">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                replace={true}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-4 rounded-2xl px-5 py-3.5 text-sm font-bold transition-all duration-300 group ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 translate-x-1'
                      : 'text-foreground/40 hover:text-foreground hover:bg-white/5'
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="tracking-wide uppercase text-[11px]">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-6 border-t border-white/5 bg-white/5">
            <div className="flex items-center gap-4 mb-6 group cursor-pointer" onClick={() => { setIsMobileMenuOpen(false); navigate('/profile', { replace: true }); }}>
              <div className="relative">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                  {userData?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-black truncate tracking-tight">{userData?.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary italic">{userData?.role}</span>
              </div>
            </div>

            <div className="grid gap-2">
              {isInstallable && (
                <Button variant="glass" size="sm" className="w-full justify-start rounded-xl" onClick={handleInstall}>
                  <Download className="mr-3 h-4 w-4" />
                  Install App
                </Button>
              )}
              <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl text-danger/60 hover:text-danger hover:bg-danger/10" onClick={handleLogout}>
                <LogOut className="mr-3 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-50">
        {/* Mobile Header */}
        <header className="lg:hidden flex h-20 shrink-0 items-center justify-between px-6 z-50">
          <button className="p-3 bg-card/60 backdrop-blur-lg rounded-2xl border border-white/10 shadow-lg" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <img src="/Cropped.png" alt="Logo" className="h-8 w-auto" />
          <div className="flex gap-2 relative">
            <button className={`p-3 bg-card/60 backdrop-blur-lg rounded-2xl border border-white/10 shadow-lg transition-colors ${refreshCooldown > 0 ? 'text-primary' : 'opacity-40 hover:opacity-100'}`} onClick={handleManualRefresh} disabled={refreshCooldown > 0}>
              {refreshCooldown > 0 ? <span className="text-xs font-black">{refreshCooldown}</span> : <RotateCw className="h-5 w-5" />}
            </button>
            <button className="p-3 bg-card/60 backdrop-blur-lg rounded-2xl border border-white/10 shadow-lg relative" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
              <Bell className="h-5 w-5" />
              {notifications.some(n => !n.read) && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-danger animate-ping"></span>}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-16 w-[calc(100vw-3rem)] sm:w-96 rounded-[2rem] bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl z-[999] overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <h3 className="font-black italic uppercase tracking-tighter text-lg pr-2">Inbox</h3>
                  <button onClick={markAllAsRead} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Clear All</button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-12 text-center">
                      <BellOff className="h-10 w-10 mx-auto opacity-10 mb-4" />
                      <p className="text-sm font-bold opacity-30 uppercase tracking-widest">Silence is Golden</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-6 hover:bg-white/5 cursor-pointer transition-all border-l-4 ${n.read ? 'border-transparent' : 'border-primary bg-primary/5'}`}
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            if (!n.read) updateDoc(doc(db, 'notifications', n.id), { read: true });
                            navigate(n.eventId ? '/events' : (n.link || '/dashboard'));
                          }}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">{n.title}</span>
                            {!n.read && <div className="h-2 w-2 bg-primary rounded-full" />}
                          </div>
                          <p className="text-sm text-foreground/70 font-medium leading-relaxed">{n.message}</p>
                          <p className="text-[9px] font-bold opacity-20 uppercase tracking-widest mt-3">{new Date(n.createdAt).toLocaleTimeString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Desktop Header Actions */}
        <header className="hidden lg:flex h-24 shrink-0 items-center justify-between px-10 z-50">
          <div className="flex items-center gap-4">
             <div className="h-1 w-12 bg-primary/30 rounded-full" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 italic">Academic Intelligence System v1.0</span>
          </div>

          <div className="flex items-center gap-4 p-2 bg-card/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-xl">
            <div className="flex items-center gap-1 px-2">
              <button className={`p-2.5 rounded-xl transition-all ${refreshCooldown > 0 ? 'text-primary' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`} onClick={handleManualRefresh} disabled={refreshCooldown > 0}>
                {refreshCooldown > 0 ? <span className="text-xs font-black">{refreshCooldown}</span> : <RotateCw className="h-4.5 w-4.5" />}
              </button>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <div className="relative px-2">
              <button className="p-2.5 rounded-xl hover:bg-white/5 transition-all opacity-40 hover:opacity-100 relative group" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
                <Bell className="h-4.5 w-4.5" />
                {notifications.some(n => !n.read) && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger"></span>}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-6 w-96 rounded-[2.5rem] bg-card/90 backdrop-blur-xl border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] z-[999] overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="font-black italic uppercase tracking-tighter text-xl">Inbox</h3>
                    <button onClick={markAllAsRead} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Clear All</button>
                  </div>
                  <div className="max-h-[32rem] overflow-y-auto no-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-16 text-center">
                        <BellOff className="h-12 w-12 mx-auto opacity-10 mb-4" />
                        <p className="text-sm font-bold opacity-30 uppercase tracking-widest">Silence is Golden</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {notifications.map(n => (
                          <div
                            key={n.id}
                            className={`p-6 hover:bg-white/5 cursor-pointer transition-all border-l-4 ${n.read ? 'border-transparent' : 'border-primary bg-primary/5'}`}
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              if (!n.read) updateDoc(doc(db, 'notifications', n.id), { read: true });
                              navigate(n.eventId ? '/events' : (n.link || '/dashboard'));
                            }}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">{n.title}</span>
                              {!n.read && <div className="h-2 w-2 bg-primary rounded-full" />}
                            </div>
                            <p className="text-sm text-foreground/70 font-medium leading-relaxed">{n.message}</p>
                            <p className="text-[9px] font-bold opacity-20 uppercase tracking-widest mt-3">{new Date(n.createdAt).toLocaleTimeString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <OfflineIndicator />
      <AutoReminder />

      {/* Notification Prompt Refactored */}
      {showNotificationPrompt && (
        <div className="fixed bottom-10 right-10 z-[100] w-96 animate-in slide-in-from-right-8 duration-500">
          <div className="bg-primary/20 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center text-center gap-6">
              <div className="h-20 w-20 bg-primary/20 rounded-[2rem] flex items-center justify-center shadow-inner">
                <Bell className="h-10 w-10 text-primary animate-bounce" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black italic uppercase tracking-tighter">Stay Connected</h4>
                <p className="text-sm opacity-60 font-medium">Get instant alerts for assignments, events, and class updates.</p>
              </div>
              <div className="flex gap-3 w-full">
                <Button className="flex-1 rounded-2xl" onClick={() => { requestPermission(); setShowNotificationPrompt(false); }}>Enable Now</Button>
                <Button variant="ghost" className="flex-1 rounded-2xl" onClick={() => setShowNotificationPrompt(false)}>Later</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
