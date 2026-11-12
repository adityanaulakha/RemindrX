import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, BellRing, BookOpen, Activity,
  ListTodo, MessageSquare, CalendarRange, CheckCircle2, Clock
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeSwitch } from '../components/ui/ThemeSwitch';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { BrandLockup, BrandMark } from '../components/BrandMark';

const features = [
  {
    icon: ListTodo,
    title: 'Timeline',
    body: 'Deadlines and the events you are going to, in the order they happen.',
  },
  {
    icon: CalendarDays,
    title: 'Timetable',
    body: 'A date-wise class schedule once you connect the GLA student portal.',
  },
  {
    icon: Activity,
    title: 'Attendance',
    body: 'Overall attendance, CPI, and subject percentages from your portal session.',
  },
  {
    icon: BookOpen,
    title: 'Subjects',
    body: 'The subjects your class representative adds, with credits and updates.',
  },
  {
    icon: MessageSquare,
    title: 'Class updates',
    body: 'Posts from your section that classmates can confirm or dispute.',
  },
  {
    icon: CalendarRange,
    title: 'Events',
    body: 'Campus events you can browse, join, or submit for approval.',
  },
];

function ProductPreview() {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card/90 p-4 shadow-[var(--shadow-lg)] sm:p-5 motion-float">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
          </div>
          <Badge tone="primary">Live workspace</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-surface-elevated/90 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="text-sm font-semibold tracking-tight">Section overview</p>
              </div>
              <BellRing className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                { title: 'Data Structures lab report', meta: 'Due Thu · Timeline', done: false },
                { title: 'Tech fest orientation', meta: 'Fri 4:00 PM · Events', done: true },
                { title: 'Class update: room change', meta: 'Confirmed by section', done: true },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/50 px-3 py-2.5">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 text-warning" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-elevated/90 p-4">
              <p className="text-xs text-muted-foreground">Attendance</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="relative flex h-[72px] w-[72px] items-center justify-center">
                  <svg width="72" height="72" className="-rotate-90" aria-hidden>
                    <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * 0.28}`}
                      className="text-primary"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-primary">Sync</span>
                </div>
                <div className="min-w-0 flex-1 space-y-2.5">
                  {[
                    { name: 'DSA', kind: 'Theory' },
                    { name: 'OS Lab', kind: 'Lab' },
                  ].map((row) => (
                    <div key={row.name}>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="font-medium text-foreground">{row.name}</span>
                        <span className="text-muted-foreground">{row.kind}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-3/5 rounded-full bg-primary/80" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated/90 p-4">
              <p className="text-xs text-muted-foreground">Timetable</p>
              <div className="mt-3 space-y-2">
                {[
                  ['09:00', 'Operating Systems', 'LT-3'],
                  ['11:00', 'DBMS Lab', 'Lab-2'],
                ].map(([time, title, room]) => (
                  <div key={title} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2">
                    <span className="text-xs font-semibold text-primary">{time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{title}</p>
                      <p className="text-[11px] text-muted-foreground">{room}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { preference, setPreference } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app-canvas min-h-screen text-foreground">
      <header className={`fixed inset-x-0 top-0 z-40 px-4 pt-safe transition-all sm:px-6 ${scrolled ? 'border-b border-border bg-background/80 backdrop-blur-xl' : ''}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3">
          <button type="button" className="flex items-center" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <BrandLockup markSize={36} wordmarkClassName="text-base" />
          </button>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeSwitch preference={preference} onChange={setPreference} compact />
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hidden h-10 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Sign in
            </button>
            <Button onClick={() => navigate('/login')} size="sm" className="h-10">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="page-enter">
            <Badge tone="primary" className="mb-4">For college sections</Badge>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
              Your campus section, in one polished workspace.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              RemindrX keeps subjects, deadlines, GLA attendance, the timetable, class updates, and campus events together — after you verify your college email.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate('/login')}>
                Open RemindrX <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                See what’s included
              </Button>
            </div>
          </div>

          <ProductPreview />
        </section>

        <section id="features" className="mt-24 sm:mt-28">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built around a real section, not a generic to-do list.</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Sign in with your college email, join the section code from your class representative, and the same tools are available on your phone.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="group rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-lg)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform duration-200 group-hover:scale-105">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative mt-16 overflow-hidden rounded-3xl border border-primary/25 bg-primary-soft px-6 py-10 sm:px-10">
          <h2 className="relative max-w-xl text-3xl font-semibold tracking-tight">Sign in with your college email to join your section.</h2>
          <p className="relative mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            New accounts need a verified institutional email. Class representatives use an invite code when they join.
          </p>
          <Button className="relative mt-6" size="lg" onClick={() => navigate('/login')}>
            Continue to sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BrandMark size={32} alt="" className="rounded-lg" />
            <span className="text-sm font-semibold">RemindrX</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} RemindrX. Campus reminders for your section.</p>
        </div>
      </footer>
    </div>
  );
}
