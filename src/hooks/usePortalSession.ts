import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { PortalDashboard, PortalSubject, PortalSummary } from '../services/gla/portal';
import { refreshDashboard, restorePortalSession } from '../services/gla/client';
import { loadMeta, loadSnapshot, type GlaPortalSnapshot } from '../services/gla/session';

const STALE_MS = 15 * 60 * 1000;

export interface PortalSessionState {
  live: boolean;
  stale: boolean;
  waking: boolean;
  roll: string | null;
  summary: PortalSummary;
  subjects: PortalSubject[];
  snapshot: GlaPortalSnapshot | null;
  lastSyncedAt: number | null;
  refresh: () => Promise<void>;
}

/**
 * Shared portal jar session for Attendance / Timetable / Dashboard strip.
 * Prefers live enroll session; falls back to cached snapshot with stale badge.
 */
export function usePortalSession(options?: { auto?: boolean }): PortalSessionState {
  const auto = options?.auto !== false;
  const { userData } = useAuth();
  const [live, setLive] = useState(false);
  const [waking, setWaking] = useState(false);
  const [summary, setSummary] = useState<PortalSummary>({ overall: '--', cpi: '--' });
  const [subjects, setSubjects] = useState<PortalSubject[]>([]);
  const [snapshot, setSnapshot] = useState<GlaPortalSnapshot | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [roll, setRoll] = useState<string | null>(null);

  const applyDashboard = useCallback((dash: PortalDashboard, syncedAt?: number) => {
    setSummary(dash.summary);
    setSubjects(dash.subjects);
    setLastSyncedAt(syncedAt ?? Date.now());
  }, []);

  const refresh = useCallback(async () => {
    setWaking(true);
    try {
      const dash = await refreshDashboard();
      if (dash) {
        applyDashboard(dash);
        setLive(true);
        setSnapshot(loadSnapshot());
        return;
      }
      setLive(false);
    } finally {
      setWaking(false);
    }
  }, [applyDashboard]);

  useEffect(() => {
    if (!auto) return;
    let cancelled = false;

    const boot = async () => {
      const meta = loadMeta();
      const preferred = meta.roll || userData?.rollNo || null;
      if (preferred) setRoll(preferred);

      const cached = loadSnapshot();
      if (cached && !cancelled) {
        setSnapshot(cached);
        setSummary(cached.summary);
        setSubjects(cached.subjects);
        setLastSyncedAt(cached.savedAt);
      }

      setWaking(true);
      try {
        const restored = await restorePortalSession();
        if (cancelled) return;
        if (restored.dashboard) {
          applyDashboard(restored.dashboard, restored.live ? Date.now() : restored.snapshot?.savedAt);
          setLive(restored.live);
          setSnapshot(restored.snapshot || loadSnapshot());
        } else {
          setLive(false);
        }
      } finally {
        if (!cancelled) setWaking(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [auto, userData?.rollNo, applyDashboard]);

  const stale =
    !live ||
    (lastSyncedAt != null && Date.now() - lastSyncedAt > STALE_MS) ||
    (snapshot != null && !live && Date.now() - snapshot.savedAt > STALE_MS);

  return {
    live,
    stale,
    waking,
    roll,
    summary,
    subjects,
    snapshot,
    lastSyncedAt,
    refresh,
  };
}
