import { useState } from 'react';
import {
  Activity, BookOpen, CalendarDays, CheckCircle2, Clock, LayoutDashboard,
  ListTodo, MapPin, MessageSquare
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ProgressRing } from '../components/ui/ProgressRing';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { ThemeSwitch } from '../components/ui/ThemeSwitch';
import { useTheme } from '../hooks/useTheme';

const sampleSubjects = [
  { code: 'DSA', name: 'Data Structures', type: 'theory', credits: 4, open: 2 },
  { code: 'OSL', name: 'Operating Systems Lab', type: 'lab', credits: 1.5, open: 1 },
  { code: 'DBMS', name: 'Database Systems', type: 'theory', credits: 4, open: 0 },
];

const sampleLectures = [
  { time: '09:00–10:00', title: 'Operating Systems', room: 'LT-3', status: 'Present' },
  { time: '11:00–13:00', title: 'DBMS Lab', room: 'Lab-2', status: 'Pending' },
  { time: '14:00–15:00', title: 'Data Structures', room: 'LT-1', status: 'Absent' },
];

/**
 * Dev-only UI gallery with sample campus data for visual QA / screenshots.
 * Mounted only when import.meta.env.DEV and VITE_UI_PREVIEW=1.
 */
export default function UIPreview() {
  const { preference, setPreference } = useTheme();
  const [view, setView] = useState<'dashboard' | 'attendance' | 'timetable' | 'timeline'>('dashboard');

  return (
    <div className="app-canvas min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Dev preview</p>
            <h1 className="text-lg font-semibold tracking-tight">RemindrX UI gallery</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeSwitch preference={preference} onChange={setPreference} compact />
            {(['dashboard', 'attendance', 'timetable', 'timeline'] as const).map((id) => (
              <Button
                key={id}
                size="sm"
                variant={view === id ? 'primary' : 'secondary'}
                onClick={() => setView(id)}
                className="capitalize"
              >
                {id}
              </Button>
            ))}
          </div>
        </div>

        {view === 'dashboard' && (
          <div className="space-y-6 page-enter">
            <PageHeader eyebrow="Good afternoon" title="Hello, Aditya" description="Sample dashboard composition with section stats and subject cards." />
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Subjects" value={6} icon={BookOpen} />
              <StatCard label="Active tasks" value={3} icon={Clock} tone="warning" />
              <StatCard label="Upcoming events" value={2} icon={CalendarDays} tone="accent" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {sampleSubjects.map((s) => (
                <Card key={s.code} interactive className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-xs font-semibold text-primary">{s.code}</div>
                    <Badge tone={s.type === 'lab' ? 'accent' : 'primary'}>{s.type}</Badge>
                  </div>
                  <h3 className="font-semibold tracking-tight">{s.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.open} open tasks · {s.credits} credits</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {view === 'attendance' && (
          <div className="space-y-6 page-enter">
            <PageHeader eyebrow="Live portal sync" title="Attendance" description="Signed in as 221500000 — portal session connected · CPI synced" />
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="flex items-center gap-5 p-6" elevated>
                <ProgressRing value={78} size={96} stroke={9} label="Overall" />
                <div>
                  <p className="text-xs text-muted-foreground">Overall attendance</p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">From GLA portal session</p>
                  <Badge className="mt-3" tone="success">On track</Badge>
                </div>
              </Card>
              <Card className="p-6" elevated>
                <p className="text-xs text-muted-foreground">Current CPI</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">CPI</p>
                <p className="mt-1 text-sm text-muted-foreground">Synced from student portal</p>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['Data Structures', 'Theory'],
                ['Operating Systems', 'Theory'],
                ['DBMS Lab', 'Lab'],
              ].map(([name, kind]) => (
                <Card key={String(name)} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold tracking-tight">{name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{kind} · subject attendance</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/40 text-[10px] font-semibold text-primary">
                      Sync
                    </div>
                  </div>
                  <ProgressBar value={70} tone="primary" className="mt-4" />
                </Card>
              ))}
            </div>
          </div>
        )}

        {view === 'timetable' && (
          <div className="space-y-6 page-enter">
            <PageHeader eyebrow="Live · My timetable" title="Timetable" description="Schedule for the selected date with Present / Absent markers." />
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/60 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold text-primary">Thursday</p>
                  <p className="text-sm text-muted-foreground">12 Nov 2026</p>
                </div>
                <Badge>{sampleLectures.length} lectures</Badge>
              </div>
              <div className="divide-y divide-border">
                {sampleLectures.map((lec) => (
                  <div key={lec.title} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-semibold tracking-tight">{lec.title}</p>
                      <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lec.time}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lec.room}</span>
                      </p>
                    </div>
                    <Badge tone={lec.status === 'Present' ? 'success' : lec.status === 'Absent' ? 'danger' : 'warning'}>{lec.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {view === 'timeline' && (
          <div className="space-y-6 page-enter">
            <PageHeader
              eyebrow="Deadlines and events"
              title="Timeline"
              description="Sample tasks and joined events in time order."
              actions={<Button><ListTodo className="h-4 w-4" /> Add task</Button>}
            />
            <div className="space-y-4">
              {[
                { title: 'Lab report submission', meta: 'Thu 5:00 PM · Critical', tone: 'danger' as const },
                { title: 'Tech fest orientation', meta: 'Fri 4:00 PM · Event', tone: 'accent' as const },
                { title: 'Quiz revision checklist', meta: 'Sat 10:00 AM · Medium', tone: 'primary' as const },
              ].map((item) => (
                <Card key={item.title} className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      {item.tone === 'accent' ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-semibold tracking-tight">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                  </div>
                  <Badge tone={item.tone}>{item.tone === 'danger' ? 'Due soon' : item.tone === 'accent' ? 'Going' : 'Open'}</Badge>
                </Card>
              ))}
              <EmptyState
                icon={MessageSquare}
                title="No more items"
                description="Older completed tasks stay collapsed until you expand history."
                className="py-10"
              />
            </div>
          </div>
        )}

        <div className="grid gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-xs text-muted-foreground sm:grid-cols-4">
          <span className="inline-flex items-center gap-2"><LayoutDashboard className="h-3.5 w-3.5 text-primary" /> Dashboard shell</span>
          <span className="inline-flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-primary" /> Attendance rings</span>
          <span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-primary" /> Timetable day view</span>
          <span className="inline-flex items-center gap-2"><ListTodo className="h-3.5 w-3.5 text-primary" /> Timeline cards</span>
        </div>
      </div>
    </div>
  );
}
