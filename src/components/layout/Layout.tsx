import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, updateDoc, doc,
  limit, orderBy, writeBatch
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, LayoutDashboard, ListTodo, LogOut, Menu, X,
  ShieldAlert, CalendarRange, MessageSquare, Activity, Bell, Download,
  RotateCw, BellOff, CalendarDays, MoreHorizontal
} from 'lucide-react';
import { Button, cn } from '../ui/Button';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { OfflineIndicator } from '../OfflineIndicator';
import { AutoReminder } from '../AutoReminder';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../hooks/useTheme';

type InboxNote = {
  id: string;
  read?: boolean;
  title?: string;
  message?: string;
  createdAt: number;
  eventId?: string;
  link?: string;
};

type NavItem = { name: string; path: string; icon: typeof BookOpen };

export default function Layout() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isInstallable, handleInstall } = usePWAInstall();
  const { requestPermission } = useNotifications();
  const { preference, setPreference } = useTheme();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InboxNote[]>([]);
  const [notificationLimit, setNotificationLimit] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  useEffect(() => {
    const lastRefresh = parseInt(localStorage.getItem('last_refresh') || '0');
    const now = Date.now();
    if (now - lastRefresh < 10000) {
      setRefreshCooldown(Math.ceil((10000 - (now - lastRefresh)) / 1000));
    }

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
      const fetched = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as InboxNote[];
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

  const navItems: NavItem[] = [
    { name: 'Events', path: '/events', icon: CalendarRange },
  ];

  if (userData?.classId) {
    navItems.unshift(
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Subjects', path: '/subjects', icon: BookOpen },
      { name: 'Attendance', path: '/attendance', icon: Activity },
      { name: 'Timetable', path: '/timetable', icon: CalendarDays },
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

  const mobilePrimary: NavItem[] = userData?.classId
    ? [
        { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Timeline', path: '/timeline', icon: ListTodo },
        { name: 'Schedule', path: '/timetable', icon: CalendarDays },
        { name: 'Events', path: '/events', icon: CalendarRange },
      ]
    : [{ name: 'Events', path: '/events', icon: CalendarRange }];

  const moreActive = !mobilePrimary.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const unread = notifications.some(n => !n.read);

  const openNotification = (n: InboxNote) => {
    setIsNotificationsOpen(false);
    if (!n.read) updateDoc(doc(db, 'notifications', n.id), { read: true });
    navigate(n.eventId ? '/events' : (n.link || '/dashboard'));
  };

  return (
    <div className="app-canvas flex h-screen overflow-hidden text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[90] focus:rounded-xl focus:bg-card focus:px-3 focus:py-2 focus:shadow-sm"
      >
        Skip to content
      </a>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-[#050508]/55 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100%,17.5rem)] flex-col border-r border-border bg-surface/90 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-4 pt-safe">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1 text-left"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate(userData?.isSuperAdmin && !userData?.classId ? '/super-admin' : '/dashboard');
            }}
          >
            <span className="relative">
              <span className="absolute inset-0 rounded-xl bg-primary/30 blur-md" />
              <img src="/Logo.png" alt="" className="relative h-9 w-9 rounded-xl object-cover ring-1 ring-border" />
            </span>
            <span className="truncate text-base font-semibold tracking-tight">RemindrX</span>
          </button>
          <button
            type="button"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              replace
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-soft text-primary glow-ring'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-border p-3 pb-safe">
          <ThemeSwitch preference={preference} onChange={setPreference} />
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate('/profile');
            }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--glow)]">
              {userData?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{userData?.name}</span>
              <span className="block truncate text-xs capitalize text-muted-foreground">{userData?.role}</span>
            </span>
          </button>
          <div className="grid gap-1">
            {isInstallable && (
              <Button variant="secondary" size="sm" className="w-full justify-start" onClick={handleInstall}>
                <Download className="h-4 w-4" />
                Install app
              </Button>
            )}
            <Button variant="ghost" size="sm" className="w-full justify-start text-danger hover:bg-danger/10 hover:text-danger" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/70 px-3 backdrop-blur-xl pt-safe sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="hidden text-sm text-muted-foreground sm:block">
              {userData?.section ? `Section ${userData.section}` : 'Campus workspace'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden lg:block">
              <ThemeSwitch preference={preference} onChange={setPreference} compact />
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
              onClick={handleManualRefresh}
              disabled={refreshCooldown > 0}
              aria-label={refreshCooldown > 0 ? `Refresh available in ${refreshCooldown} seconds` : 'Refresh'}
            >
              {refreshCooldown > 0 ? <span className="text-xs font-semibold text-primary">{refreshCooldown}</span> : <RotateCw className="h-4 w-4" />}
            </button>
            <div className="relative">
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setIsNotificationsOpen((open) => !open)}
                aria-label="Notifications"
                aria-expanded={isNotificationsOpen}
              >
                <Bell className="h-4 w-4" />
                {unread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger shadow-[0_0_0_3px_var(--background)]" />}
              </button>
              {isNotificationsOpen && (
                <div className="absolute right-0 z-[70] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[var(--shadow-lg)] page-enter">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-sm font-semibold">Inbox</h2>
                    <button type="button" onClick={markAllAsRead} className="text-xs font-medium text-primary hover:underline">
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-6 py-10 text-center">
                        <BellOff className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">You're all caught up</p>
                      </div>
                    ) : (
                      <ul>
                        {notifications.map((n) => (
                          <li key={n.id}>
                            <button
                              type="button"
                              className={`w-full border-l-2 px-4 py-3 text-left transition-colors hover:bg-muted ${n.read ? 'border-transparent' : 'border-primary bg-primary-soft/50'}`}
                              onClick={() => openNotification(n)}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-primary">{n.title}</span>
                                {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                              </span>
                              <span className="mt-1 block text-sm leading-relaxed text-foreground">{n.message}</span>
                              <span className="mt-2 block text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {hasMore && notifications.length > 0 && (
                      <button
                        type="button"
                        className="w-full border-t border-border px-4 py-3 text-sm font-medium text-primary hover:bg-muted"
                        onClick={() => setNotificationLimit((value) => value + 10)}
                      >
                        Show earlier
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 overflow-y-auto px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          <div className="mx-auto max-w-6xl page-enter">
            <Outlet />
          </div>
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-safe backdrop-blur-xl lg:hidden"
          aria-label="Mobile"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobilePrimary.length + 1}, minmax(0, 1fr))` }}>
            {mobilePrimary.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                replace
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('rounded-xl p-1', isActive && 'bg-primary-soft')}>
                      <item.icon className="h-5 w-5" />
                    </span>
                    {item.name}
                  </>
                )}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn(
                'flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium',
                moreActive || isMobileMenuOpen ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span className={cn('rounded-xl p-1', (moreActive || isMobileMenuOpen) && 'bg-primary-soft')}>
                <MoreHorizontal className="h-5 w-5" />
              </span>
              More
            </button>
          </div>
        </nav>
      </div>

      <OfflineIndicator />
      <AutoReminder />

      {showNotificationPrompt && (
        <div className="fixed bottom-24 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] lg:bottom-6 lg:right-6 page-enter">
          <div className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-[var(--shadow-lg)]">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold tracking-tight">Stay in the loop</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Get alerts for deadlines, events, and class updates.
            </p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => { requestPermission(); setShowNotificationPrompt(false); }}>
                Enable
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setShowNotificationPrompt(false)}>
                Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
