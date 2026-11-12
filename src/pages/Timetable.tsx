import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  RefreshCw,
  MapPin,
  User,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  CircleDashed,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';
import type { PortalLecture } from '../services/gla/portal';
import {
  attendanceFromStatus,
  daysInMonth,
  fetchTimetableForDate,
  formatPortalDate,
  isDateInCurrentMonth,
  lectureAttendanceStatus,
  lecturesForDate,
  restorePortalSession,
  startOfMonth,
  toInputDateValue,
} from '../services/gla/client';
import { loadMeta, loadTimetableSnapshot } from '../services/gla/session';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function typeBadge(lecType?: string): string {
  const t = lecType || '';
  if (t.includes('Lab')) return 'bg-primary/10 text-primary border-primary/25';
  if (t.includes('Tut')) return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-primary/15 text-primary border-primary/20';
}

function attendanceBadge(tone: ReturnType<typeof attendanceFromStatus>['tone']): string {
  switch (tone) {
    case 'present':
      return 'bg-success/15 text-success border-success/30';
    case 'absent':
      return 'bg-danger/15 text-danger border-danger/30';
    case 'completed':
      return 'bg-primary/10 text-primary border-primary/25';
    case 'pending':
      return 'bg-warning/15 text-warning border-warning/30';
    default:
      return 'bg-foreground/10 text-foreground/60 border-border';
  }
}

function AttendanceIcon({ tone }: { tone: ReturnType<typeof attendanceFromStatus>['tone'] }) {
  if (tone === 'present') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (tone === 'absent') return <XCircle className="h-3.5 w-3.5" />;
  return <CircleDashed className="h-3.5 w-3.5" />;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Timetable() {
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [grouped, setGrouped] = useState<Record<string, PortalLecture[]>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [roll, setRoll] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [fetchedEmpty, setFetchedEmpty] = useState(false);

  const portalSelected = formatPortalDate(selectedDate);
  const dayLectures = useMemo(
    () => lecturesForDate(grouped, portalSelected),
    [grouped, portalSelected]
  );

  const datesWithLectures = useMemo(() => {
    const set = new Set<string>();
    for (const lec of Object.values(grouped).flat()) {
      if (lec.LecDate) set.add(String(lec.LecDate));
    }
    return set;
  }, [grouped]);

  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const total = daysInMonth(viewMonth);
    const lead = first.getDay();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const loadDay = async (date: Date, opts?: { toastOnError?: boolean; merge?: boolean }) => {
    if (!isDateInCurrentMonth(date)) {
      toast.error('You cannot select a date from the previous month. Please select a date from the current month.');
      return false;
    }
    setDayLoading(true);
    setFetchedEmpty(false);
    try {
      const result = await fetchTimetableForDate(date, opts?.merge === false ? null : grouped);
      if (!result) {
        setNeedsConnect(true);
        if (opts?.toastOnError) toast.error('Could not load timetable — reconnect on Attendance.');
        return false;
      }
      setGrouped(result.grouped);
      setCached(false);
      setNeedsConnect(false);
      setFetchedEmpty(result.day.length === 0);
      return true;
    } catch {
      if (opts?.toastOnError) toast.error('Timetable request failed');
      return false;
    } finally {
      setDayLoading(false);
      setLoading(false);
    }
  };

  const syncSelected = async () => {
    setRefreshing(true);
    const ok = await loadDay(selectedDate, { toastOnError: true, merge: false });
    if (ok) toast.success('Timetable refreshed');
    setRefreshing(false);
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const meta = loadMeta();
      if (meta.roll) setRoll(meta.roll);

      const cachedSnap = loadTimetableSnapshot();
      if (cachedSnap?.grouped) {
        setGrouped(cachedSnap.grouped);
        setCached(true);
        const today = new Date();
        const portalToday = formatPortalDate(today);
        const hasToday = lecturesForDate(cachedSnap.grouped, portalToday).length > 0;
        const pick = hasToday && isDateInCurrentMonth(today) ? today : today;
        setSelectedDate(pick);
        setViewMonth(startOfMonth(pick));
      }

      const restored = await restorePortalSession();
      if (cancelled) return;

      if (!restored.live && !restored.dashboard && !cachedSnap?.grouped) {
        setNeedsConnect(true);
        setLoading(false);
        return;
      }

      if (!restored.live && !restored.dashboard) {
        setNeedsConnect(true);
        setLoading(false);
        return;
      }

      await loadDay(new Date(), { merge: true });
    };

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectDate = async (date: Date) => {
    if (!isDateInCurrentMonth(date)) {
      toast.error('You cannot select a date from the previous month. Please select a date from the current month.');
      return;
    }
    setSelectedDate(date);
    setViewMonth(startOfMonth(date));
    await loadDay(date, { toastOnError: true, merge: true });
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
    const now = new Date();
    if (next.getFullYear() !== now.getFullYear() || next.getMonth() !== now.getMonth()) {
      toast.error('You cannot select a date from the previous month. Please select a date from the current month.');
      return;
    }
    setViewMonth(next);
  };

  const presentCount = dayLectures.filter((l) => attendanceFromStatus(lectureAttendanceStatus(l)).tone === 'present').length;
  const absentCount = dayLectures.filter((l) => attendanceFromStatus(lectureAttendanceStatus(l)).tone === 'absent').length;
  const pendingCount = dayLectures.filter((l) => attendanceFromStatus(lectureAttendanceStatus(l)).tone === 'pending').length;
  const heldCount = dayLectures.filter((l) => attendanceFromStatus(lectureAttendanceStatus(l)).tone === 'completed').length;

  if (loading) return <PageSkeleton rows={4} />;

  if (needsConnect && Object.keys(grouped).length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Portal login required"
        description="Connect your GLA portal on the Attendance page first, then come back for My timetable."
        action={
          <Link to="/attendance">
            <Button>Open Attendance</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={cached ? 'Cached · My timetable' : 'Live · My timetable'}
        title="Timetable"
        description={`${roll ? `Schedule for ${roll}` : 'Schedule for the selected date'} — current month only, with Present / Absent per lecture (same as the GLA app).`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void syncSelected()}
              disabled={refreshing || dayLoading}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing || dayLoading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Link to="/attendance">
              <Button variant="ghost">Attendance</Button>
            </Link>
          </>
        }
      />

      {needsConnect && Object.keys(grouped).length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4 text-sm font-medium text-warning/80">
          Showing cached timetable. Portal session may have expired — open Attendance to reconnect, then Sync.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-normal text-primary">Switch to calendar</p>
              <h2 className="text-lg font-semibold tracking-tight">
                {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="h-10 w-10 rounded-2xl p-0">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" aria-label="Next month" onClick={() => shiftMonth(1)} className="h-10 w-10 rounded-2xl p-0">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell) return <div key={`e-${i}`} className="aspect-square" />;
              const portal = formatPortalDate(cell);
              const selected = sameDay(cell, selectedDate);
              const today = sameDay(cell, new Date());
              const hasData = datesWithLectures.has(portal);
              const inMonth = isDateInCurrentMonth(cell);
              return (
                <button
                  key={portal}
                  type="button"
                  disabled={!inMonth || dayLoading}
                  onClick={() => selectDate(cell)}
                  className={`aspect-square rounded-2xl border text-sm font-bold transition-colors relative ${
                    selected
                      ? 'border-primary/50 bg-primary/20 text-foreground'
                      : inMonth
                        ? 'border-border bg-muted text-foreground/80 hover:bg-muted'
                        : 'border-transparent text-muted-foreground'
                  } ${today && !selected ? 'ring-1 ring-primary/40' : ''}`}
                >
                  {cell.getDate()}
                  {hasData && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Jump to date
            <input
              type="date"
              value={toInputDateValue(selectedDate)}
              min={toInputDateValue(startOfMonth(new Date()))}
              max={toInputDateValue(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                if (!y || !m || !d) return;
                void selectDate(new Date(y, m - 1, d));
              }}
              className="control h-11"
            />
          </label>
        </Card>

        <Card className="overflow-hidden">
          <header className="flex flex-col justify-between gap-3 border-b border-border bg-muted/70 px-6 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold tracking-normal text-primary">Schedule for the selected date</p>
              <h2 className="text-sm font-semibold tracking-normal text-foreground/70">{formatDisplayDate(selectedDate)}</h2>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {dayLoading ? 'Loading…' : `${dayLectures.length} lecture${dayLectures.length === 1 ? '' : 's'}`}
            </span>
          </header>

          {dayLectures.length > 0 && (
            <div className="px-5 pt-4 flex flex-wrap gap-3 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Present {presentCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-3 py-1.5 text-danger">
                <XCircle className="h-3.5 w-3.5" /> Absent {absentCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-warning">
                <CircleDashed className="h-3.5 w-3.5" /> Pending {pendingCount}
              </span>
              {heldCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-primary">
                  Not marked {heldCount}
                </span>
              )}
            </div>
          )}

          {dayLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-xs font-medium">Fetching lectures for the selected date…</span>
            </div>
          ) : dayLectures.length === 0 ? (
            <p className="text-center text-sm opacity-50 py-14 px-6">
              {fetchedEmpty || datesWithLectures.size > 0
                ? 'There are no timetable entries for the selected date.'
                : 'No timetable loaded yet. Tap Sync after reconnecting.'}
            </p>
          ) : (
            <div className="divide-y divide-border mt-2">
              {dayLectures.map((lec, i) => {
                const att = attendanceFromStatus(lectureAttendanceStatus(lec));
                return (
                  <article
                    key={`${portalSelected}-${lec.LecNo ?? i}-${lec.SuCode ?? lec.SuName ?? ''}`}
                    className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-primary/5 transition-colors"
                  >
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        {lec.LecNo != null && lec.LecNo !== '' && (
                          <span className="text-xs font-medium text-muted-foreground">Lec {lec.LecNo}</span>
                        )}
                        <h3 className="font-semibold text-lg tracking-tight truncate">{lec.SuName || 'Untitled'}</h3>
                        {lec.LecType && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${typeBadge(lec.LecType)}`}>
                            {lec.LecType}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground font-medium">
                        {lec.LecTime && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 opacity-60" /> {lec.LecTime}
                          </span>
                        )}
                        {lec.EmpName && (
                          <span className="inline-flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 opacity-60" /> {lec.EmpName}
                          </span>
                        )}
                        {(lec.RoomNo || lec.Building) && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 opacity-60" />
                            {[lec.RoomNo, lec.Building].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="self-start md:self-center flex flex-col items-end gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${attendanceBadge(att.tone)}`}
                        title={lectureAttendanceStatus(lec) || att.label}
                      >
                        <AttendanceIcon tone={att.tone} />
                        {att.label}
                      </span>
                      {lec.LecStatus &&
                        !/present|absent/i.test(String(lec.PresentStatus || '')) &&
                        /completed|pending/i.test(String(lec.LecStatus)) && (
                          <span className="text-xs font-bold tracking-normal text-muted-foreground">
                            Class {String(lec.LecStatus)}
                          </span>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
