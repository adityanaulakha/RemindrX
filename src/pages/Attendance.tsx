import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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

type Gate = 'loading' | 'connect' | 'pin-setup' | 'pin-unlock' | 'ready';

function subjectPercent(sub: PortalSubject): number {
  const n = typeof sub.attendance === 'number' ? sub.attendance : parseFloat(String(sub.attendance));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export default function Attendance() {
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<Gate>('loading');
  const [live, setLive] = useState(false);

  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [summary, setSummary] = useState<PortalSummary>({ overall: '--', cpi: '--' });
  const [subjects, setSubjects] = useState<PortalSubject[]>([]);
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);

  const loadCaptcha = async () => {
    try {
      if (captchaUrl) URL.revokeObjectURL(captchaUrl);
      const blob = await fetchCaptchaBlob();
      setCaptchaUrl(URL.createObjectURL(blob));
      setCaptcha('');
    } catch {
      toast.error('Could not load captcha (backend may be waking up — retry in a few seconds)');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const meta = loadMeta();
      if (meta.roll) {
        setRoll(meta.roll);
        setSessionLabel(meta.roll);
      }

      const restored = await restorePortalSession();
      if (cancelled) return;

      if (restored.dashboard) {
        setSummary(restored.dashboard.summary);
        setSubjects(restored.dashboard.subjects);
        setLive(restored.live);
        if (hasLocalPin() && !isSessionUnlocked()) {
          setGate('pin-unlock');
        } else if (!hasLocalPin() && restored.live) {
          setGate('pin-setup');
        } else {
          setGate('ready');
        }
        return;
      }

      if (restored.snapshot) {
        setSummary(restored.snapshot.summary);
        setSubjects(restored.snapshot.subjects);
        setLive(false);
      }

      setGate('connect');
      await loadCaptcha();
    };

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast.error('Login request failed — is the portal backend awake?');
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
    return (
      <div className="min-h-[50vh] flex items-center justify-center gap-3 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-xs font-medium">Restoring your GLA session…</span>
      </div>
    );
  }

  if (gate === 'pin-unlock') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-md mx-auto space-y-8">
        <Lock className="h-16 w-16 text-primary" />
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Unlock attendance</h1>
          <p className="text-sm text-muted-foreground">Enter your 4-digit RemindrX PIN for {sessionLabel || 'your GLA session'}.</p>
        </div>
        <form onSubmit={handlePinUnlock} className="w-full space-y-6">
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
      </div>
    );
  }

  if (gate === 'pin-setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-md mx-auto space-y-8">
        <ShieldCheck className="h-16 w-16 text-primary" />
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Set local PIN</h1>
          <p className="text-sm text-muted-foreground">
            Optional: unlock RemindrX with a PIN next time instead of re-typing portal credentials (while the portal session is still alive).
          </p>
        </div>
        <form onSubmit={handlePinSetup} className="w-full space-y-6">
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
      </div>
    );
  }

  if (gate === 'connect') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full animate-pulse" />
          <div className="relative h-40 w-40 rounded-3xl bg-card/40 border border-border flex items-center justify-center shadow-2xl">
            <GraduationCap className="h-20 w-20 text-primary" />
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-1 w-12 bg-primary rounded-full" />
            <span className="text-xs font-semibold tracking-normal text-primary">GLA Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-none">
            Attendance
          </h1>
          <p className="text-sm font-medium text-muted-foreground max-w-md mx-auto leading-relaxed">
            Sign in with your GLA student portal roll number and password. A captcha is required.
          </p>
        </div>

        <div className="w-full bg-card/60 border border-border rounded-3xl p-10 lg:p-16 shadow-sm">
          <form onSubmit={handleConnect} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Input label="Roll Number" placeholder="Roll number" value={roll} onChange={(e) => setRoll(e.target.value)} required />
              <Input label="Portal Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-muted-foreground ml-1">Captcha</label>
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                {captchaUrl ? (
                  <img
                    src={captchaUrl}
                    alt="Captcha"
                    onClick={loadCaptcha}
                    className="h-16 w-full sm:w-64 object-cover rounded-2xl border border-border cursor-pointer bg-white"
                    title="Click to refresh"
                  />
                ) : (
                  <div className="h-16 w-full sm:w-64 rounded-2xl border border-border flex items-center justify-center text-xs opacity-40">
                    Loading captcha…
                  </div>
                )}
                <Button type="button" variant="ghost" onClick={loadCaptcha} className="rounded-2xl">
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
              </div>
              <Input
                label="Enter Captcha"
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                required
              />
            </div>

            <div className="p-6 rounded-2xl bg-warning/10 border border-warning/25 flex items-start gap-4">
              <ShieldCheck className="h-6 w-6 text-warning shrink-0 mt-1" />
              <p className="text-xs font-medium text-warning/70 leading-relaxed">
                The portal service may take a moment to wake up on the first request.
              </p>
            </div>

            <Button type="submit" className="w-full h-16 rounded-2xl font-semibold tracking-normal" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin" /> Connecting…
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  Connect portal <Zap className="h-5 w-5" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const overallNum = parseFloat(String(summary.overall));
  const overallOk = Number.isFinite(overallNum) ? overallNum >= 75 : true;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="relative overflow-hidden rounded-3xl bg-card/60 border border-border p-10 lg:p-16 shadow-sm">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Activity className="h-64 w-64 text-primary" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-primary rounded-full" />
              <span className="text-xs font-semibold tracking-normal text-primary">
                {live ? 'Live Portal Sync' : 'Cached Snapshot'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-none pr-8">
              Attendance
            </h1>
            <p className="text-sm font-medium text-muted-foreground max-w-xl leading-relaxed">
              {sessionLabel ? `Signed in as ${sessionLabel}` : 'GLA portal'} — overall {summary.overall}
              {summary.overall !== '--' ? '%' : ''} · CPI {summary.cpi}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-2 bg-muted rounded-2xl border border-border shadow-inner">
            <Link to="/timetable">
              <Button variant="ghost" className="h-14 px-8 rounded-xl font-medium">
                <CalendarDays className="h-4 w-4 mr-3" /> Timetable
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleRefresh} disabled={loading} className="h-14 px-8 rounded-xl font-medium">
              <RefreshCw className={`h-4 w-4 mr-3 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button variant="ghost" onClick={handleDisconnect} className="h-14 px-8 rounded-xl font-medium text-danger hover:bg-danger/10">
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`rounded-2xl border p-8 bg-card/60 ${overallOk ? 'border-success/25' : 'border-danger/25'}`}>
          <p className="text-xs font-medium opacity-40 mb-2">Overall Attendance</p>
          <p className="text-5xl font-semibold">
            {summary.overall}
            {summary.overall !== '--' ? '%' : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/20 p-8 bg-card/60">
          <p className="text-xs font-medium opacity-40 mb-2">Current CPI</p>
          <p className="text-5xl font-semibold">{summary.cpi}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {subjects.map((sub, i) => {
          const percentage = subjectPercent(sub);
          const isDanger = percentage < 75;
          const circumference = 2 * Math.PI * 34;
          const strokeDashoffset = circumference - (percentage / 100) * circumference;

          return (
            <div
              key={`${sub.name}-${i}`}
              className={`group relative bg-card/60  border rounded-3xl p-8 transition-all duration-500  overflow-hidden ${isDanger ? 'border-danger/25' : 'border-success/25'}`}
            >
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="relative h-40 w-40 flex items-center justify-center mb-8">
                  <svg className="h-full w-full transform -rotate-90">
                    <circle cx="80" cy="80" r="34" className="stroke-foreground/5" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="80"
                      cy="80"
                      r="34"
                      className={`transition-all duration-1000 ease-out ${isDanger ? 'stroke-danger' : 'stroke-success'}`}
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold">{percentage}%</span>
                    <span className="text-xs font-medium text-muted-foreground">Attendance</span>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <h3 className="font-semibold text-xl tracking-tighter leading-snug group-hover:text-primary transition-colors">
                    {sub.name}
                  </h3>
                </div>

                <div className="w-full">
                  {isDanger ? (
                    <div className="bg-danger/10 rounded-2xl p-6 border border-danger/20 flex flex-col items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-danger" />
                      <p className="text-xs font-semibold tracking-tight text-danger/80">Below 75%</p>
                    </div>
                  ) : (
                    <div className="bg-success/10 rounded-2xl p-6 border border-success/20 flex flex-col items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-success" />
                      <p className="text-xs font-semibold tracking-tight text-success/80">At or above 75%</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {subjects.length === 0 && (
        <p className="text-center text-sm opacity-40">No subject rows returned. Try Sync after the backend wakes up.</p>
      )}
    </div>
  );
}
