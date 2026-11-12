import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { ThemeSwitch } from '../components/ui/ThemeSwitch';
import { useTheme } from '../hooks/useTheme';
import { BookOpen, School, Mail, ShieldCheck } from 'lucide-react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { Institute } from '../types';

export default function Login() {
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [dob, setDob] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    const fetchInstitutes = async () => {
      const snap = await getDocs(query(collection(db, 'institutes'), orderBy('name')));
      setInstitutes(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Institute)));
    };
    fetchInstitutes();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
          await signOut(auth);

          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const createdAt = userDoc.data()?.createdAt || 0;
          const isExpired = Date.now() - createdAt > 24 * 60 * 60 * 1000;

          if (isExpired) {
            toast.error('Verification link expired. Your unverified account has been deactivated. Please sign up again.');
          } else {
            setVerificationSent(true);
            toast.error('Please verify your email address first. Check your inbox!');
          }
          setLoading(false);
          return;
        }

        navigate('/');
      } else {
        const college = institutes.find(c => c.id === selectedCollege);
        const emailDomain = email.split('@')[1]?.toLowerCase();

        if (!college || !college.domains.includes(emailDomain)) {
          toast.error(`Invalid email. Please use your ${college?.name || 'institution'} email (Allowed: ${college?.domains.join(', ')})`);
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await sendEmailVerification(user);

        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, 'users', user.uid), {
          name,
          rollNo,
          dob,
          collegeId: selectedCollege,
          role: 'student',
          trustScore: 100,
          createdAt: Date.now(),
          email: email
        }, { merge: true });

        await signOut(auth);
        setVerificationSent(true);
        toast.success('Account created! Verification email sent.');
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span className="font-semibold">Account already exists</span>
            <span className="text-sm text-muted-foreground">This email is already registered. Sign in instead?</span>
            <button
              onClick={() => {
                setIsLogin(true);
                toast.dismiss(t.id);
              }}
              className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Switch to sign in
            </button>
          </div>
        ), { duration: 6000, position: 'top-center' });
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('Sign-up is currently disabled. Please enable Email/Password in Firebase Console.');
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="app-canvas flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 text-center shadow-[var(--shadow-lg)] backdrop-blur-xl page-enter">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary glow-ring">
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
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
            <img src="/Logo.png" alt="" className="h-11 w-11 rounded-2xl object-cover ring-1 ring-border" />
            <span className="text-lg font-semibold tracking-tight">RemindrX</span>
          </button>
          <ThemeSwitch preference={preference} onChange={setPreference} compact />
        </div>
        <div className="relative z-10">
          <Badge tone="primary" className="mb-4">Campus workspace</Badge>
          <h1 className="max-w-md text-4xl font-semibold tracking-tight">
            {isLogin ? 'Welcome back to your section.' : 'Create your campus account.'}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
            Subjects, deadlines, the GLA timetable, attendance, and class updates — after you verify your college email.
          </p>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4 text-primary" /> Built for college sections
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md page-enter">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2">
              <img src="/Logo.png" alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-border" />
              <span className="text-base font-semibold tracking-tight">RemindrX</span>
            </button>
            <ThemeSwitch preference={preference} onChange={setPreference} compact />
          </div>
          <p className="text-sm font-medium text-primary">{isLogin ? 'Welcome back' : 'Create your account'}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {isLogin ? 'Sign in' : 'Join your campus'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isLogin ? 'Use the college email you signed up with.' : 'Use an email from your institution. We’ll send a verification link.'}
          </p>

          <form onSubmit={handleAuth} className="mt-8 space-y-4 rounded-3xl border border-border bg-card/70 p-5 shadow-[var(--shadow)] backdrop-blur-xl sm:p-6">
            {!isLogin && (
              <>
                <Input label="Full name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input label="University roll number" placeholder="Roll number" value={rollNo} onChange={(e) => setRollNo(e.target.value)} required />
                <Input label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
              </>
            )}

            <Input label="Email" type="email" placeholder="College email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Input label="Password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={isLogin ? 'current-password' : 'new-password'} />

            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="college" className="block text-sm font-medium">College</label>
                <div className="relative">
                  <School className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    id="college"
                    className="control appearance-none pl-10"
                    value={selectedCollege}
                    onChange={(e) => setSelectedCollege(e.target.value)}
                    required
                  >
                    <option value="">Choose your college</option>
                    {institutes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
              {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="font-semibold text-primary hover:underline">
              {isLogin ? 'Need an account? Sign up' : 'Already registered? Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
