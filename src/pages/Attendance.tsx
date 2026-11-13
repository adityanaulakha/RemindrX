import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressRing } from '../components/ui/ProgressRing';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageSkeleton } from '../components/ui/Skeleton';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  GraduationCap,
  Zap,
  TrendingUp,
  ShieldCheck,
  Lock,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchCaptchaBlob, type PortalSubject, type PortalSummary } from '../services/gla/portal';
import {
  canLoadCaptcha,
  captchaCooldownSecondsLeft,
  markCaptchaRequested,
} from '../services/gla/captchaGate';
import {
  hasLocalPin,
  isSessionUnlocked,
  loadMeta,
  lockSession,
  setLocalPin,
  verifyLocalPin,
} from '../services/gla/session';
import {
  disconnectPortal,
  loginAndFetch,
  refreshDashboard,
  restorePortalSession,
} from '../services/gla/client';
import { useAuth } from '../context/AuthContext';

type Gate = 'loading' | 'connect' | 'pin-setup' | 'pin-unlock' | 'ready';

function subjectPercent(sub: PortalSubject): number {
  const n = typeof sub.attendance === 'number' ? sub.attendance : parseFloat(String(sub.attendance));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export default function Attendance() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<Gate>('loading');
  const [live, setLive] = useState(false);

  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaCooldown, setCaptchaCooldown] = useState(0);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [summary, setSummary] = useState<PortalSummary>({ overall: '--', cpi: '--' });
  const [subjects, setSubjects] = useState<PortalSubject[]>([]);
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);

  useEffect(() => {
    if (captchaCooldown <= 0) return;
    const t = window.setInterval(() => {
      const left = captchaCooldownSecondsLeft();
      setCaptchaCooldown(left);
      if (left <= 0) window.clearInterval(t);
    }, 250);
    return () => window.clearInterval(t);
  }, [captchaCooldown]);

  const loadCaptcha = async (forRoll?: string) => {
    const r = (forRoll ?? roll).trim();
    if (!r) {
      toast.error('Enter roll number before loading captcha');
      return;
    }
    if (!canLoadCaptcha()) {
      toast.error(`Wait ${captchaCooldownSecondsLeft()}s before loading captcha again`);
      return;
    }
    markCaptchaRequested();
    setCaptchaCooldown(captchaCooldownSecondsLeft());
    toast.loading('Loading captcha…', { id: 'captcha-load' });
    try {
      if (captchaUrl) URL.revokeObjectURL(captchaUrl);
      const blob = await fetchCaptchaBlob(r);
      setCaptchaUrl(URL.createObjectURL(blob));
      setCaptcha('');
      toast.success('Captcha ready', { id: 'captcha-load' });
    } catch {
      toast.error(
        'Could not load captcha. If the portal just restarted, wait ~30s and try again.',
        { id: 'captcha-load' }
      );
    }
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const meta = loadMeta();
      const preferredRoll = meta.roll || userData?.rollNo || '';
      if (preferredRoll) {
        setRoll(preferredRoll);
        setSessionLabel(preferredRoll);
      }

      // Prefer live enroll session (portal-backend jar / session token from first login)
      const restored = await restorePortalSession();
      if (cancelled) return;

      if (restored.dashboard) {
        setSummary(restored.dashboard.summary);
        setSubjects(restored.dashboard.subjects);
        setLive(restored.live);
        if (hasLocalPin() && !isSessionUnlocked()) {
          setGate('pin-unlock');
        } else if (!hasLocalPin() && restored.live && userData?.authProvider !== 'gla_portal') {
          setGate('pin-setup');
        } else {
          setGate('ready');
        }
        return;
      }

      // Enroll already saved a snapshot — show it. Don't force a second portal login.
      if (restored.snapshot) {
        setSummary(restored.snapshot.summary);
        setSubjects(restored.snapshot.subjects);
        setLive(false);
        if (hasLocalPin() && !isSessionUnlocked()) {
          setGate('pin-unlock');
        } else {
          setGate('ready');
        }
        return;
      }

      // No live jar and no enroll cache — need portal credentials once
      setGate('connect');
      if (preferredRoll) await loadCaptcha(preferredRoll);
    };

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.rollNo, userData?.authProvider]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roll || !password || !captcha) {
      toast.error('Roll, password, and captcha are required');
      return;
    }
    setLoading(true);
    try {
      const result = await loginAndFetch(roll, password, captcha);
      if (!result.ok) {
        toast.error(result.error);
        await loadCaptcha();
        setLoading(false);
        return;
      }
      setPassword('');
      setCaptcha('');
      setSummary(result.dashboard.summary);
      setSubjects(result.dashboard.subjects);
      setSessionLabel(roll.trim());
      setLive(true);
      toast.success('GLA portal connected');
      setGate(hasLocalPin() ? 'ready' : 'pin-setup');
    } catch {
      toast.error('Could not reach the portal. If it just restarted, wait ~30s and try again.');
      await loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handlePinSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== pinConfirm) {
      toast.error('PINs do not match');
      return;
    }
    try {
      await setLocalPin(pin);
      setPin('');
      setPinConfirm('');
      toast.success('Local PIN saved — reopen won’t ask for portal password while session is alive');
      setGate('ready');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid PIN');
    }
  };

  const handlePinUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await verifyLocalPin(pin);
    setLoading(false);
    if (!ok) {
      toast.error('That PIN is incorrect');
      return;
    }
    setPin('');
    const dash = await refreshDashboard();
    if (dash) {
      setSummary(dash.summary);
      setSubjects(dash.subjects);
      setLive(true);
    }
    setGate('ready');
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const dash = await refreshDashboard();
      if (!dash) {
        toast.error('Session expired — please sign in again');
        setLive(false);
        setGate('connect');
        await loadCaptcha();
        return;
      }
      setSummary(dash.summary);
      setSubjects(dash.subjects);
      setLive(true);
      toast.success('Attendance refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect GLA portal session?')) return;
    setLoading(true);
    await disconnectPortal();
    lockSession();
    setSubjects([]);
    setSummary({ overall: '--', cpi: '--' });
    setLive(false);
    setGate('connect');
    await loadCaptcha();
    setLoading(false);
    toast.success('Disconnected');
  };

  if (gate === 'loading') {
    return <PageSkeleton rows={3} />;
  }

  if (gate === 'pin-unlock') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Lock className="h-7 w-7" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Unlock attendance</h1>
          <p className="text-sm text-muted-foreground">Enter your 4-digit RemindrX PIN for {sessionLabel || 'your GLA session'}.</p>
        </div>
        <Card className="w-full p-6">
          <form onSubmit={handlePinUnlock} className="space-y-4">
            <Input
              label="4-digit PIN"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
            />
            <Button type="submit" className="w-full" disabled={loading || pin.length !== 4}>
              Unlock
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={handleDisconnect}>
              Sign out of GLA
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (gate === 'pin-setup') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Set local PIN</h1>
          <p className="text-sm text-muted-foreground">
            Optional: unlock RemindrX with a PIN next time instead of re-typing portal credentials (while the portal session is still alive).
          </p>
        </div>
        <Card className="w-full p-6">
          <form onSubmit={handlePinSetup} className="space-y-4">
            <Input
              label="New 4-digit PIN"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
            />
            <Input
              label="Confirm PIN"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
            />
            <Button type="submit" className="w-full" disabled={pin.length !== 4 || pinConfirm.length !== 4}>
              Save PIN & continue
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setGate('ready')}>
              Skip for now
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (gate === 'connect') {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          eyebrow="GLA Portal"
          title="Attendance"
          description={
            userData?.authProvider === 'gla_portal'
              ? 'Your portal session expired. Re-enter password and captcha — roll is prefilled from enroll.'
              : 'Reconnect your GLA Student Corner session. Enter roll first, then load captcha.'
          }
        />
        <Card elevated className="p-6 sm:p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <GraduationCap className="h-7 w-7" />
          </div>
          <form onSubmit={handleConnect} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Roll Number" placeholder="Roll number" value={roll} onChange={(e) => setRoll(e.target.value)} required />
              <Input label="Portal Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium">Captcha</label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {captchaUrl ? (
                  <img
                    src={captchaUrl}
                    alt="Captcha"
                    onClick={() => loadCaptcha()}
                    className="h-16 w-full cursor-pointer rounded-xl border border-border bg-white object-cover sm:w-64"
                    title="Click to refresh"
                  />
                ) : (
                  <div className="flex h-16 w-full items-center justify-center rounded-xl border border-border text-xs text-muted-foreground sm:w-64">
                    Enter roll, then load captcha
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => loadCaptcha()}
                  disabled={captchaCooldown > 0}
                >
                  <RefreshCw className="h-4 w-4" />
                  {captchaCooldown > 0
                    ? `Wait ${captchaCooldown}s`
                    : captchaUrl
                      ? 'Refresh'
                      : 'Load'}
                </Button>
              </div>
              <Input label="Enter Captcha" value={captcha} onChange={(e) => setCaptcha(e.target.value)} required />
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/10 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="text-sm text-warning/80">
                Portal stays warm via keep-alive. If a ping was missed and Render restarted, the first request can take ~30–60s — we retry automatically.
              </p>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Connecting…</span>
              ) : (
                <span className="flex items-center gap-2">Connect portal <Zap className="h-4 w-4" /></span>
              )}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const overallNum = parseFloat(String(summary.overall));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={live ? 'Live portal sync' : 'From your enroll session'}
        title="Attendance"
        description={`${sessionLabel ? `Roll ${sessionLabel}` : 'GLA portal'} — overall ${summary.overall}${summary.overall !== '--' ? '%' : ''} · CPI ${summary.cpi}`}
        actions={
          <>
            <Link to="/timetable"><Button variant="secondary"><CalendarDays className="h-4 w-4" /> Timetable</Button></Link>
            <Button variant="secondary" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </>
        }
      />

      {!live && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-warning/90">
            Showing numbers from your last portal sync. Use Sync for a live refresh; reconnect (password + captcha) only if the GLA session expired or the portal restarted.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={async () => {
              setGate('connect');
              if (roll) await loadCaptcha(roll);
            }}
          >
            Refresh live
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-5 p-6" elevated>
          <ProgressRing value={Number.isFinite(overallNum) ? overallNum : 0} size={96} stroke={9} label="Overall" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Overall attendance</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {summary.overall}{summary.overall !== '--' ? '%' : ''}
            </p>
            <Badge className="mt-3" tone={Number.isFinite(overallNum) && overallNum >= 75 ? 'success' : 'danger'}>
              {Number.isFinite(overallNum) && overallNum >= 75 ? 'On track' : 'Needs attention'}
            </Badge>
          </div>
        </Card>
        <Card className="p-6" elevated>
          <p className="text-xs font-medium text-muted-foreground">Current CPI</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{summary.cpi}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 text-primary" /> Portal academic summary
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {subjects.map((sub, i) => {
          const percentage = subjectPercent(sub);
          const isDanger = percentage < 75;
          return (
            <Card key={`${sub.name}-${i}`} className={`p-5 ${isDanger ? 'border-danger/25' : 'border-success/20'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold tracking-tight">{sub.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Subject attendance</p>
                </div>
                <ProgressRing value={percentage} size={64} stroke={6} />
              </div>
              <ProgressBar value={percentage} className="mt-4" />
              <div className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                isDanger ? 'border-danger/20 bg-danger/10 text-danger' : 'border-success/20 bg-success/10 text-success'
              }`}>
                {isDanger ? <AlertTriangle className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {isDanger ? 'Below 75%' : 'At or above 75%'}
              </div>
            </Card>
          );
        })}
      </div>

      {subjects.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No subject rows yet. Tap Sync, or Refresh live if the portal session expired.</p>
      )}
    </div>
  );
}
