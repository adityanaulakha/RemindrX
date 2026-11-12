import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, BellRing, BookOpen, Activity,
  ListTodo, MessageSquare, CalendarRange
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

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

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app-canvas min-h-screen text-foreground">
      <header className={`fixed inset-x-0 top-0 z-40 px-4 pt-safe transition-colors sm:px-6 ${scrolled ? 'border-b border-border bg-background/90 backdrop-blur-md' : ''}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <button type="button" className="flex items-center gap-2.5" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/Logo.png" alt="" className="h-9 w-9 rounded-xl object-cover" />
            <span className="text-base font-semibold tracking-tight">RemindrX</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hidden h-10 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6">
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-primary">For college sections</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
              Your classes, deadlines, and section updates in one place.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              RemindrX is a campus workspace for your class: subjects, a shared timeline, attendance from the GLA portal, and events that need a real sign-in.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Open RemindrX <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold"
              >
                See what’s included
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow)] sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Today</p>
                <p className="text-lg font-semibold tracking-tight">What the app keeps together</p>
              </div>
              <BellRing className="h-5 w-5 text-primary" />
            </div>
            <ul className="mt-4 space-y-3">
              {[
                ['Timeline', 'Tasks and joined events, sorted by time'],
                ['Timetable', 'The selected day’s lectures, after portal login'],
                ['Class updates', 'Posts your section can confirm or dispute'],
              ].map(([title, body]) => (
                <li key={title} className="rounded-2xl bg-muted px-4 py-3">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="mt-20 sm:mt-28">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built around a real section, not a generic to-do list.</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Sign in with your college email, join the section code from your class representative, and the same tools are available on your phone.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight">Sign in with your college email to join your section.</h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
            New accounts need a verified institutional email. Class representatives use an invite code when they join.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-card px-5 text-sm font-semibold text-foreground"
          >
            Continue to sign in <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <img src="/Logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold">RemindrX</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} RemindrX. Campus reminders for your section.</p>
        </div>
      </footer>
    </div>
  );
}
