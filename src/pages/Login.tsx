import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { ThemeSwitch } from '../components/ui/ThemeSwitch';
import { useTheme } from '../hooks/useTheme';
import { BookOpen, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { BrandLockup } from '../components/BrandMark';
import { fetchCaptchaBlob, portalEnroll } from '../services/gla/portal';
import { markConnected, saveSnapshot } from '../services/gla/session';
import {
  canLoadCaptcha,
  captchaCooldownSecondsLeft,
  markCaptchaRequested,
} from '../services/gla/captchaGate';

type Mode = 'portal' | 'staff';

export default function Login() {
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const [mode, setMode] = useState<Mode>('portal');
  const [loading, setLoading] = useState(false);

  // Portal enroll
  const [roll, setRoll] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaCooldown, setCaptchaCooldown] = useState(0);

  // Staff / super-admin email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

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
      toast.error('Enter your roll number first, then load captcha');
      return;
    }
    if (!canLoadCaptcha()) {
      toast.error(`Wait ${captchaCooldownSecondsLeft()}s before loading captcha again`);
      return;
    }
    markCaptchaRequested();
    setCaptchaCooldown(captchaCooldownSecondsLeft());
    toast.loading('Loading captcha… portal may take a few seconds to wake', { id: 'captcha-load' });
    try {
      if (captchaUrl) URL.revokeObjectURL(captchaUrl);
      const blob = await fetchCaptchaBlob(r);
      setCaptchaUrl(URL.createObjectURL(blob));
      setCaptcha('');
      toast.success('Captcha ready', { id: 'captcha-load' });
    } catch {
      toast.error('Could not load captcha (backend may be waking up — retry in a few seconds)', {
        id: 'captcha-load',
      });
    }
  };

  useEffect(() => {
    return () => {
      if (captchaUrl) URL.revokeObjectURL(captchaUrl);
    };
  }, [captchaUrl]);

  const handlePortalEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roll.trim() || !portalPassword || !captcha.trim()) {
      toast.error('Roll, password, and captcha are required');
      return;
    }
    setLoading(true);
    try {
      const result = await portalEnroll(roll.trim(), portalPassword, captcha.trim());
      if (!result.success || !result.customToken) {
        toast.error(result.error || 'Portal enroll failed');
        await loadCaptcha();
        return;
      }

      await signInWithCustomToken(auth, result.customToken);

      // Keep local portal session meta so Attendance/Timetable reuse the live jar
      markConnected(result.profile?.roll || roll.trim(), result.portalSession);
      if (result.profile?.summary && result.profile.subjects) {
        saveSnapshot({
          summary: {
            overall: result.profile.summary.overall ?? '--',
            cpi: result.profile.summary.cpi ?? '--',
          },
          subjects: (result.profile.subjects || []).map((s) => ({
            name: s.name || 'Subject',
            attendance: (s as { attendance?: string | number }).attendance ?? '--',
            code: s.code,
            type: s.type,
          })),
        });
      }

      setPortalPassword('');
      setCaptcha('');
      toast.success(
        result.classCreated
          ? 'Enrolled — your section was created from the portal'
          : 'Signed in with GLA portal'
      );
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Enroll failed');
      await loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleStaffAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        await signOut(auth);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const createdAt = userDoc.data()?.createdAt || 0;
        const isExpired = Date.now() - createdAt > 24 * 60 * 60 * 1000;
        if (isExpired) {
          toast.error('Verification link expired. Please contact an admin.');
        } else {
          setVerificationSent(true);
          toast.error('Please verify your email address first.');
        }
        return;
      }

      navigate('/');
    } catch (error: unknown) {
      console.error('Auth Error:', error);
      const message = error instanceof Error ? error.message : 'Sign in failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="app-canvas flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 text-center shadow-[var(--shadow-lg)] backdrop-blur-xl page-enter">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-primary-soft text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-muted/60 p-4 text-left">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Look in spam or promotions if it is not in your inbox within a minute.
            </p>
          </div>
          <Button onClick={() => setVerificationSent(false)} className="mt-6 w-full" size="lg">
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-canvas min-h-screen lg:grid lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface/70 px-12 py-10 backdrop-blur-xl lg:flex">
        <div className="relative z-10 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center text-left">
            <BrandLockup markSize={44} wordmarkClassName="text-lg" />
          </button>
          <ThemeSwitch preference={preference} onChange={setPreference} compact />
        </div>
        <div className="relative z-10">
          <Badge tone="primary" className="mb-4">GLA portal enroll</Badge>
          <h1 className="max-w-md text-4xl font-semibold tracking-tight">
            {mode === 'portal' ? 'Sign in with your Student Corner.' : 'Staff & admin email sign-in.'}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
            {mode === 'portal'
              ? 'Use your GLA roll number and portal password. RemindrX maps your section and subjects automatically.'
              : 'Email login is reserved for Super Admins and existing staff accounts.'}
          </p>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4 text-primary" /> Built for college sections
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md page-enter">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <button type="button" onClick={() => navigate('/')} className="flex items-center">
              <BrandLockup markSize={36} wordmarkClassName="text-base" />
            </button>
            <ThemeSwitch preference={preference} onChange={setPreference} compact />
          </div>

          <p className="text-sm font-medium text-primary">
            {mode === 'portal' ? 'Student enroll' : 'Staff sign in'}
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {mode === 'portal' ? 'GLA portal' : 'Email account'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === 'portal'
              ? 'Roll + portal password + captcha. Your section is mapped automatically.'
              : 'Use the college email for Super Admin / staff.'}
          </p>

          {mode === 'portal' ? (
            <form
              onSubmit={handlePortalEnroll}
              className="mt-8 space-y-4 rounded-3xl border border-border bg-card/70 p-5 shadow-[var(--shadow)] backdrop-blur-xl sm:p-6"
            >
              <Input
                label="University roll number"
                placeholder="e.g. 2215000000"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                required
                autoComplete="username"
              />
              <Input
                label="Portal password"
                type="password"
                placeholder="Student Corner password"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
                required
                autoComplete="current-password"
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium">Captcha</label>
                  <button
                    type="button"
                    onClick={() => loadCaptcha()}
                    disabled={captchaCooldown > 0}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {captchaCooldown > 0
                      ? `Wait ${captchaCooldown}s`
                      : captchaUrl
                        ? 'Refresh'
                        : 'Load captcha'}
                  </button>
                </div>
                {captchaUrl ? (
                  <img
                    src={captchaUrl}
                    alt="GLA captcha"
                    className="h-14 w-full rounded-xl border border-border bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-14 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                    Enter roll, then load captcha
                  </div>
                )}
                <Input
                  placeholder="Enter captcha text"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>

              <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
                {loading ? 'Enrolling…' : 'Enroll with portal'}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={handleStaffAuth}
              className="mt-8 space-y-4 rounded-3xl border border-border bg-card/70 p-5 shadow-[var(--shadow)] backdrop-blur-xl sm:p-6"
            >
              <Input
                label="Email"
                type="email"
                placeholder="Staff email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
                {loading ? 'Please wait…' : 'Sign in'}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setMode(mode === 'portal' ? 'staff' : 'portal')}
              className="font-semibold text-primary hover:underline"
            >
              {mode === 'portal' ? 'Staff / Super Admin email login' : 'Student portal enroll'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
