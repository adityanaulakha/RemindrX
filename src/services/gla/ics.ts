import type { PortalLecture } from './portal';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Build ICS stamp from portal LecDate (M/D/YYYY or similar) + optional LecTime ("09:00-10:00"). */
function lectureBounds(lec: PortalLecture): { start: Date; end: Date } | null {
  const raw = String(lec.LecDate || '').trim();
  if (!raw) return null;
  const parts = raw.split(/[/-]/).map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  // Portal often uses M/D/YYYY
  const [a, b, c] = parts;
  const year = c > 31 ? c : a > 31 ? a : c;
  const month = c > 31 ? a : b;
  const day = c > 31 ? b : c > 12 ? b : a > 12 ? b : a;
  const time = String(lec.LecTime || '').trim();
  let startH = 9;
  let startM = 0;
  let endH = 10;
  let endM = 0;
  const m = time.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (m) {
    startH = parseInt(m[1]!, 10);
    startM = parseInt(m[2]!, 10);
    endH = parseInt(m[3]!, 10);
    endM = parseInt(m[4]!, 10);
  }
  const start = new Date(year, month - 1, day, startH, startM, 0);
  const end = new Date(year, month - 1, day, endH, endM, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function lecturesToIcs(lectures: PortalLecture[], calendarName = 'RemindrX Timetable'): string {
  const now = toIcsUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RemindrX//Timetable//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];

  lectures.forEach((lec, i) => {
    const bounds = lectureBounds(lec);
    if (!bounds) return;
    const title = [lec.SuName || lec.SuCode || 'Lecture', lec.LecType].filter(Boolean).join(' · ');
    const loc = [lec.RoomNo, lec.Building].filter(Boolean).join(', ');
    const desc = [lec.EmpName, lec.LecStatus, lec.PresentStatus].filter(Boolean).join(' · ');
    const uid = `gla-${String(lec.LecDate)}-${String(lec.LecNo || i)}-${String(lec.SuCode || 'x')}@remindrx`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(uid)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsUtc(bounds.start)}`,
      `DTEND:${toIcsUtc(bounds.end)}`,
      `SUMMARY:${escapeIcs(title)}`,
      loc ? `LOCATION:${escapeIcs(loc)}` : '',
      desc ? `DESCRIPTION:${escapeIcs(desc)}` : '',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

export function downloadIcs(filename: string, icsBody: string): void {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
