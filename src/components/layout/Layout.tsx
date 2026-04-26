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
  Sun, Moon, RotateCw
} from 'lucide-react';
import { Button } from '../ui/Button';
import { GlobalFAB } from '../GlobalFAB';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { OfflineIndicator } from '../OfflineIndicator';

export default function Layout() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const { isInstallable, handleInstall } = usePWAInstall();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationLimit, setNotificationLimit] = useState(10);
  const [hasMore, setHasMore] = useState(true);

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

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const navItems = [
    { name: 'Global Events', path: '/events', icon: CalendarRange },
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
    navItems.push({ name: 'Admin Panel', path: '/admin', icon: ShieldAlert });
  }

  if (userData?.isSuperAdmin) {
    navItems.push({ name: 'Super Admin', path: '/super-admin', icon: ShieldAlert });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <div className="flex items-center">
            <img src="/Cropped.png" alt="Logo" className="h-8 w-auto" />
          </div>
          <button
            className="lg:hidden text-foreground/60 hover:text-foreground"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/70 hover:bg-border/50 hover:text-foreground'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full border-t border-border p-4 bg-card">
          <div className="mb-4 flex items-center gap-3 px-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
              {userData?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div
              className="flex flex-col flex-1 overflow-hidden cursor-pointer hover:opacity-80"
              onClick={() => navigate('/profile')}
            >
              <span className="text-sm font-medium leading-none truncate">{userData?.name}</span>
              <span className="text-xs text-foreground/50 mt-1 capitalize">{userData?.role}</span>
            </div>
          </div>

          <div className="space-y-2">
            {isInstallable && (
              <Button
                variant="outline"
                className="w-full justify-start border-primary/30 text-primary hover:bg-primary/5"
                onClick={handleInstall}
              >
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
            )}
            <Button variant="ghost" className="w-full justify-start text-danger hover:text-danger hover:bg-danger/10" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <div className="flex items-center gap-3">
            <button
              className="text-foreground/60 hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <img src="/Cropped.png" alt="Logo" className="h-7 w-auto" />
          </div>

          <div className="flex items-center gap-1">
            <button
              className="p-2 rounded-full hover:bg-border transition-colors text-foreground/60 hover:text-foreground"
              onClick={() => window.location.reload()}
              title="Refresh App"
            >
              <RotateCw className="h-4.5 w-4.5" />
            </button>
            <button
              className="p-2 rounded-full hover:bg-border transition-colors text-foreground/60 hover:text-foreground"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
            </button>
            {userData?.classId && (
              <div className="relative">
                <button
                  className="relative p-2 text-foreground/60 hover:text-foreground"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                >
                  <Bell className="h-4.5 w-4.5" />
                  {notifications.filter(n => !n.read).length > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger"></span>}
                </button>

                {isNotificationsOpen && (
                  <div className="fixed inset-x-4 top-16 mt-2 rounded-xl bg-card border border-border shadow-2xl z-[60] overflow-hidden lg:absolute lg:inset-auto lg:right-0 lg:w-80">
                    <div className="p-4 border-b border-border bg-primary/5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm">Notifications</h3>
                        {notifications.some(n => !n.read) && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <button onClick={() => setIsNotificationsOpen(false)} className="lg:hidden text-foreground/40">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-[70vh] lg:max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Bell className="h-6 w-6 text-primary/40" />
                          </div>
                          <p className="text-sm font-bold text-foreground/80">All Caught Up!</p>
                          <p className="text-xs text-foreground/40 mt-1">No new alerts in the last 5 days.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {notifications.map(n => (
                            <div
                              key={n.id}
                              className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors border-l-4 ${n.read ? 'border-transparent' : 'border-primary bg-primary/5'}`}
                              onClick={async () => {
                                setIsNotificationsOpen(false);
                                if (!n.read) {
                                  try {
                                    await updateDoc(doc(db, 'notifications', n.id), { read: true });
                                  } catch (e) { console.error(e); }
                                }
                                navigate(n.eventId ? '/events' : (n.link || '/dashboard'));
                              }}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <p className={`text-xs font-bold ${n.type === 'event_rejection' ? 'text-danger' : 'text-primary'}`}>{n.title}</p>
                                {!n.read && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-black">NEW</span>}
                              </div>
                              <p className="text-[11px] text-foreground/70 leading-relaxed">{n.message}</p>
                              {n.remarks && (
                                <div className="mt-2 p-2 bg-background/50 rounded border border-border/50 text-xs italic">
                                  "{n.remarks}"
                                </div>
                              )}
                              <p className="text-[9px] text-foreground/40 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                          ))}
                          {hasMore && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setNotificationLimit(prev => prev + 10); }}
                              className="w-full py-3 text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
                            >
                              Load Older Notifications
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 shrink-0 items-center justify-end border-b border-border bg-card px-8 gap-2">
          <button
            className="p-2 rounded-full hover:bg-border transition-colors text-foreground/60 hover:text-foreground"
            onClick={() => window.location.reload()}
            title="Refresh App"
          >
            <RotateCw className="h-5 w-5" />
          </button>
          <button
            className="p-2 rounded-full hover:bg-border transition-colors text-foreground/60 hover:text-foreground"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          {userData?.classId && (
            <div className="relative">
              <button
                className="relative p-2 text-foreground/60 hover:text-foreground rounded-full hover:bg-border transition-colors"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <Bell className="h-5 w-5" />
                {notifications.filter(n => !n.read).length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-danger border-2 border-card"></span>}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-card border border-border shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-border bg-primary/5 flex justify-between items-center">
                    <h3 className="font-bold">Notifications</h3>
                    {notifications.some(n => !n.read) && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                          <Bell className="h-5 w-5 text-primary/40" />
                        </div>
                        <p className="text-xs font-bold text-foreground/80">No Notifications</p>
                        <p className="text-[10px] text-foreground/40">No New Notifications!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {notifications.map(n => (
                          <div
                            key={n.id}
                            className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors border-l-4 ${n.read ? 'border-transparent' : 'border-primary bg-primary/5'}`}
                            onClick={async () => {
                              setIsNotificationsOpen(false);
                              if (!n.read) {
                                try {
                                  await updateDoc(doc(db, 'notifications', n.id), { read: true });
                                } catch (e) { console.error(e); }
                              }
                              navigate(n.eventId ? '/events' : (n.link || '/dashboard'));
                            }}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <p className={`text-sm font-bold ${n.type === 'event_rejection' ? 'text-danger' : 'text-primary'}`}>{n.title}</p>
                              {!n.read && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-black">NEW</span>}
                            </div>
                            <p className="text-xs text-foreground/70 leading-relaxed">{n.message}</p>
                            {n.remarks && (
                              <div className="mt-2 p-2 bg-background/50 rounded border border-border/50">
                                <p className="text-[10px] font-bold uppercase tracking-tight text-foreground/40 mb-1">Moderator Remarks:</p>
                                <p className="text-xs italic text-foreground/80">"{n.remarks}"</p>
                              </div>
                            )}
                            <p className="text-[10px] text-foreground/40 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                        ))}
                        {hasMore && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setNotificationLimit(prev => prev + 10); }}
                            className="w-full py-3 text-xs font-bold text-primary hover:bg-primary/5 transition-colors border-t border-border"
                          >
                            Load Older Notifications
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-8 pb-safe pt-safe">
          <div className="mx-auto max-w-5xl pb-12">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Floating Action Button */}
      {userData?.classId && <GlobalFAB />}
      <OfflineIndicator />
    </div>
  );
}
