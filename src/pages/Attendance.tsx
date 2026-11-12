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
      <div className="min-h-[50vh] flex items-center justify-center gap-3 text-foreground/40">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Restoring GLA session…</span>
      </div>
    );
  }

  if (gate === 'pin-unlock') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-md mx-auto space-y-8">
        <Lock className="h-16 w-16 text-primary" />
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Unlock Pulse</h1>
          <p className="text-sm text-foreground/40">Enter your 4-digit RemindrX PIN for {sessionLabel || 'your GLA session'}.</p>
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
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Set local PIN</h1>
          <p className="text-sm text-foreground/40">
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
          <div className="relative h-40 w-40 rounded-[3rem] bg-card/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
            <GraduationCap className="h-20 w-20 text-primary" />
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-1 w-12 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">GLA Portal</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none">
            Pulse Monitor
          </h1>
          <p className="text-sm font-medium text-foreground/40 max-w-md mx-auto leading-relaxed">
            Sign in with your GLA student portal credentials (same flow as portal-frontend). Captcha required.
          </p>
        </div>

        <div className="w-full bg-card/60 backdrop-blur-xl border border-white/10 rounded-[4rem] p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
          <form onSubmit={handleConnect} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Input label="Roll Number" placeholder="e.g. 21BCE10234" value={roll} onChange={(e) => setRoll(e.target.value)} required />
              <Input label="Portal Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-widest text-foreground/40 ml-1 italic">Captcha</label>
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                {captchaUrl ? (
                  <img
                    src={captchaUrl}
                    alt="Captcha"
                    onClick={loadCaptcha}
                    className="h-16 w-full sm:w-64 object-cover rounded-2xl border border-white/10 cursor-pointer bg-white"
                    title="Click to refresh"
                  />
                ) : (
                  <div className="h-16 w-full sm:w-64 rounded-2xl border border-white/10 flex items-center justify-center text-xs opacity-40">
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

            <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
              <ShieldCheck className="h-6 w-6 text-amber-500 shrink-0 mt-1" />
              <p className="text-xs font-medium text-amber-500/70 leading-relaxed">
                Uses your portal-backend at portal-backend-z9ce.onrender.com (from portal-frontend). Free Render hosts may sleep — first request can take ~30s.
              </p>
            </div>

            <Button type="submit" className="w-full h-16 rounded-[2rem] font-black uppercase tracking-[0.2em] italic" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin" /> Connecting…
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  Connect Matrix <Zap className="h-5 w-5" />
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
      <div className="relative overflow-hidden rounded-[3.5rem] bg-card/60 backdrop-blur-xl border border-white/10 p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Activity className="h-64 w-64 text-primary" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">
                {live ? 'Live Portal Sync' : 'Cached Snapshot'}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
              Attendance
            </h1>
            <p className="text-sm font-medium text-foreground/40 max-w-xl leading-relaxed">
              {sessionLabel ? `Signed in as ${sessionLabel}` : 'GLA portal'} — overall {summary.overall}
              {summary.overall !== '--' ? '%' : ''} · CPI {summary.cpi}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-2 bg-white/5 rounded-[2.5rem] border border-white/5 shadow-inner">
            <Link to="/timetable">
              <Button variant="ghost" className="h-14 px-8 rounded-[1.8rem] font-black uppercase tracking-widest italic">
                <CalendarDays className="h-4 w-4 mr-3" /> Timetable
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleRefresh} disabled={loading} className="h-14 px-8 rounded-[1.8rem] font-black uppercase tracking-widest italic">
              <RefreshCw className={`h-4 w-4 mr-3 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button variant="ghost" onClick={handleDisconnect} className="h-14 px-8 rounded-[1.8rem] font-black uppercase tracking-widest italic text-danger hover:bg-danger/10">
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`rounded-[2.5rem] border p-8 bg-card/60 ${overallOk ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Overall Attendance</p>
          <p className="text-5xl font-black italic">
            {summary.overall}
            {summary.overall !== '--' ? '%' : ''}
          </p>
        </div>
        <div className="rounded-[2.5rem] border border-primary/20 p-8 bg-card/60">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Current CPI</p>
          <p className="text-5xl font-black italic">{summary.cpi}</p>
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
              className={`group relative bg-card/60 backdrop-blur-xl border rounded-[3.5rem] p-8 transition-all duration-500 hover:scale-[1.03] overflow-hidden ${isDanger ? 'border-rose-500/20' : 'border-emerald-500/20'}`}
            >
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="relative h-40 w-40 flex items-center justify-center mb-8">
                  <svg className="h-full w-full transform -rotate-90">
                    <circle cx="80" cy="80" r="34" className="stroke-foreground/5" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="80"
                      cy="80"
                      r="34"
                      className={`transition-all duration-1000 ease-out ${isDanger ? 'stroke-rose-500' : 'stroke-emerald-500'}`}
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black italic">{percentage}%</span>
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-30">Accuracy</span>
                  </div>
                </div>

                <div className="space-y-2 mb-8">
                  <h3 className="font-black text-xl tracking-tighter italic uppercase leading-snug group-hover:text-primary transition-colors">
                    {sub.name}
                  </h3>
                </div>

                <div className="w-full">
                  {isDanger ? (
                    <div className="bg-rose-500/10 rounded-[2rem] p-6 border border-rose-500/10 flex flex-col items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      <p className="text-xs font-black uppercase italic tracking-tight text-rose-500/80">Below 75% — Short</p>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 rounded-[2rem] p-6 border border-emerald-500/10 flex flex-col items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                      <p className="text-xs font-black uppercase italic tracking-tight text-emerald-500/80">On track — Good</p>
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
