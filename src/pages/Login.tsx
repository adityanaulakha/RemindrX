import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BookOpen, School, Mail, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { Institute } from '../types';

export default function Login() {
  const navigate = useNavigate();
  const { userData, setUserData } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [dob, setDob] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  
  // Verification States
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    // Fetch Dynamic Institutes
    const fetchInstitutes = async () => {
      const snap = await getDocs(query(collection(db, 'institutes'), orderBy('name')));
      setInstitutes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Institute)));
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
          
          // Check if link expired (24h)
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
        // Signup Domain Validation
        const college = institutes.find(c => c.id === selectedCollege);
        const emailDomain = email.split('@')[1]?.toLowerCase();
        
        if (!college || !college.domains.includes(emailDomain)) {
          toast.error(`Invalid email. Please use your ${college?.name || 'institution'} email (Allowed: ${college?.domains.join(', ')})`);
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Send Verification Email
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

        // Immediately sign out after signup until verified
        await signOut(auth);
        setVerificationSent(true);
        toast.success('Account created! Verification email sent.');
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span className="font-bold">Account already exists!</span>
            <span className="text-sm opacity-80">This email is already registered. Would you like to login instead?</span>
            <button 
              onClick={() => {
                setIsLogin(true);
                toast.dismiss(t.id);
              }}
              className="mt-1 px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-bold uppercase tracking-wider"
            >
              Switch to Login
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-background font-['Outfit'] overflow-hidden relative">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="w-full max-w-xl z-10 animate-in fade-in zoom-in duration-700">
          <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-[3rem] p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x" />
            
            <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
              <Mail className="h-12 w-12 text-primary animate-bounce" />
            </div>
            
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4">Transmission Sent</h2>
            <p className="text-foreground/40 font-bold uppercase tracking-widest text-[10px] mb-10">Verification link dispatched to {email}</p>

            <div className="grid gap-6">
              <div className="flex items-start gap-6 p-8 rounded-[2rem] bg-white/5 text-left border border-white/10 relative group">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <ShieldCheck className="h-8 w-8 text-primary shrink-0 relative" />
                <div className="relative">
                  <p className="text-xs font-black uppercase tracking-widest text-primary mb-2 italic">Security Protocol</p>
                  <p className="text-sm text-foreground/60 font-medium leading-relaxed">
                    Check your <span className="text-foreground font-bold">Spam or Promotions</span> folder if the message doesn't appear in your primary inbox within 60 seconds.
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => setVerificationSent(false)} 
                size="xl"
                className="w-full rounded-[2rem]"
              >
                Return to Base
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background font-['Outfit'] overflow-hidden relative">
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '5s' }} />
      </div>

      <div className="w-full max-w-[480px] z-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
        <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-[3.5rem] p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] relative overflow-hidden">
          {/* Header Branding */}
          <div className="text-center mb-12 relative">
            <div className="inline-block mb-8 relative group cursor-none">
              <img src="/Cropped.png" alt="Logo" className="h-20 w-auto relative group-hover:scale-110 transition-transform duration-500" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic opacity-60">
              {isLogin ? 'Login to your account' : 'Join the student network'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <>
                <Input
                  label="Full Name"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="University Roll No."
                  placeholder="e.g. 21BCE10234"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  required
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                />
              </>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="id@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {!isLogin && (
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-foreground/40 ml-1 italic">Authorized Institution</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary z-10 opacity-40">
                    <School className="h-5 w-5" />
                  </div>
                  <select
                    className="flex h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-14 py-2 text-sm font-bold uppercase tracking-widest italic text-foreground/60 focus:ring-2 focus:ring-primary/40 appearance-none transition-all cursor-pointer backdrop-blur-md"
                    value={selectedCollege}
                    onChange={(e) => setSelectedCollege(e.target.value)}
                    required
                  >
                    <option value="" className="bg-card text-foreground">Select Node...</option>
                    {institutes.map(c => (
                      <option key={c.id} value={c.id} className="bg-card text-foreground">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <Button
              type="submit"
              size="xl"
              className="w-full shadow-2xl"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-widest italic">Authenticating...</span>
                </div>
              ) : (
                <span className="text-sm font-black italic uppercase tracking-[0.2em]">{isLogin ? 'Login' : 'Sign Up'}</span>
              )}
            </Button>
          </form>

          <div className="mt-12 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-black uppercase tracking-widest text-foreground/30 hover:text-primary transition-all p-4 rounded-2xl hover:bg-white/5 italic"
            >
              {isLogin ? "// Create New Account" : "// Access Existing Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
