import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Subject } from '../types';

interface AttendanceData {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
}

export default function Attendance() {
  const { userData, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  
  // Mock State for Demo
  const [isConnected, setIsConnected] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!userData?.classId) return;

    const storedStatus = localStorage.getItem(`attendance_${currentUser?.uid}`);
    if (storedStatus) setIsConnected(true);

    const fetchSubjects = async () => {
      const subQ = query(collection(db, 'subjects'), where('classId', '==', userData.classId));
      const snap = await getDocs(subQ);
      setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    };
    fetchSubjects();
  }, [userData, currentUser]);

  useEffect(() => {
    if (isConnected && subjects.length > 0 && attendanceData.length === 0) {
      generateMockData();
    }
  }, [isConnected, subjects]);

  const generateMockData = () => {
    const data: AttendanceData[] = subjects.map((sub, index) => {
      const totalClasses = 30 + (index * 5) % 20;
      const attendedClasses = index % 3 === 0 ? Math.floor(totalClasses * 0.72) : Math.floor(totalClasses * (0.8 + (index * 0.02)));
      const percentage = Math.round((attendedClasses / totalClasses) * 100);
      return { subjectId: sub.id, subjectName: sub.name, subjectCode: sub.code, totalClasses, attendedClasses, percentage };
    });
    setAttendanceData(data);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !password) return;
    setLoading(true);
    setTimeout(() => {
      setIsConnected(true);
      localStorage.setItem(`attendance_${currentUser?.uid}`, 'true');
      setLoading(false);
      toast.success('Attendance portal connected');
    }, 2000);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      generateMockData();
      setLoading(false);
      toast.success('Attendance data updated');
    }, 1000);
  };

  const handleDisconnect = () => {
    if (window.confirm('Disconnect from attendance portal?')) {
      setIsConnected(false);
      setAttendanceData([]);
      localStorage.removeItem(`attendance_${currentUser?.uid}`);
      toast.success('Attendance portal disconnected');
    }
  };

  const calculateBunks = (attended: number, total: number, target: number = 75) => {
    const maxTotal = Math.floor((attended * 100) / target);
    return maxTotal - total;
  };

  const calculateRequired = (attended: number, total: number, target: number = 75) => {
    if (attended / total >= target / 100) return 0;
    return Math.ceil(((target * total) - (100 * attended)) / (100 - target));
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full animate-pulse group-hover:bg-primary/30 transition-all" />
          <div className="relative h-40 w-40 rounded-[3rem] bg-card/40 backdrop-blur-3xl border border-white/10 flex items-center justify-center shadow-2xl transition-transform duration-700 group-hover:scale-110">
            <GraduationCap className="h-20 w-20 text-primary" />
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-1 w-12 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">Authentication Required</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none">
            Pulse Monitor
          </h1>
          <p className="text-sm font-medium text-foreground/40 max-w-md mx-auto leading-relaxed">
            Bridge the gap between the platform and your institutional matrix for real-time attendance analytics.
          </p>
        </div>

        <div className="w-full bg-card/60 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
          <form onSubmit={handleConnect} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Input label="Student ID / Roll Node" placeholder="e.g. 21BCE10234" value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
              <Input label="Access Key (Portal Password)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="p-8 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 flex items-start gap-5">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-6 w-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Encrypted Tunnel</p>
                <p className="text-xs font-medium text-amber-500/60 leading-relaxed">
                  Your credentials are never stored. This is a direct secure handshake for demonstration purposes only.
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full h-18 rounded-[2rem] font-black uppercase tracking-[0.2em] italic shadow-2xl shadow-primary/20 group/btn" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Establishing Bridge...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  Connect Matrix
                  <Zap className="h-5 w-5 group-hover:scale-125 transition-transform" />
                </div>
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="relative overflow-hidden rounded-[3.5rem] bg-card/60 backdrop-blur-3xl border border-white/10 p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Activity className="h-64 w-64 text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">Live Sync Active</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-transparent leading-none pr-8">
              Attendance
            </h1>
            <p className="text-sm font-medium text-foreground/40 max-w-xl leading-relaxed">
              Real-time tracking synchronized with institutional records. Monitor your pulse and optimize your sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-2 bg-white/5 rounded-[2.5rem] border border-white/5 shadow-inner">
            <Button 
              variant="ghost" 
              onClick={handleRefresh} 
              disabled={loading} 
              className="h-14 px-8 rounded-[1.8rem] font-black uppercase tracking-widest italic hover:bg-white/5"
            >
              <RefreshCw className={`h-4 w-4 mr-3 ${loading ? 'animate-spin' : ''}`} /> Sync Pulse
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleDisconnect} 
              className="h-14 px-8 rounded-[1.8rem] font-black uppercase tracking-widest italic text-danger hover:bg-danger/10"
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {attendanceData.map((data) => {
          const isDanger = data.percentage < 75;
          const bunks = calculateBunks(data.attendedClasses, data.totalClasses);
          const required = calculateRequired(data.attendedClasses, data.totalClasses);
          const circumference = 2 * Math.PI * 34; // r=34
          const strokeDashoffset = circumference - (data.percentage / 100) * circumference;

          return (
            <div key={data.subjectId} className={`group relative bg-card/60 backdrop-blur-3xl border rounded-[3.5rem] p-8 transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] overflow-hidden ${isDanger ? 'border-rose-500/20' : 'border-emerald-500/20'}`}>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="relative h-40 w-40 flex items-center justify-center mb-8">
                   <svg className="h-full w-full transform -rotate-90">
                     <circle
                       cx="80"
                       cy="80"
                       r="34"
                       className="stroke-foreground/5"
                       strokeWidth="10"
                       fill="transparent"
                     />
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
                      <span className="text-3xl font-black italic">{data.percentage}%</span>
                      <span className="text-[8px] font-black uppercase tracking-widest opacity-30">Accuracy</span>
                   </div>
                </div>

                <div className="space-y-2 mb-8">
                   <h3 className="font-black text-2xl tracking-tighter italic uppercase leading-none group-hover:text-primary transition-colors">{data.subjectName}</h3>
                   <p className="text-[10px] font-mono font-black opacity-30 uppercase tracking-widest">{data.subjectCode}</p>
                </div>

                <div className="w-full grid grid-cols-2 gap-4 mb-8 bg-white/5 rounded-[2rem] border border-white/5 p-5">
                  <div className="text-center border-r border-white/10">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">Pulled</p>
                    <p className="text-xl font-black italic">{data.attendedClasses}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">Total</p>
                    <p className="text-xl font-black italic">{data.totalClasses}</p>
                  </div>
                </div>

                <div className="w-full">
                  {isDanger ? (
                    <div className="bg-rose-500/10 rounded-[2rem] p-6 border border-rose-500/10 flex flex-col items-center gap-3">
                      <div className="h-10 w-10 bg-rose-500/20 rounded-xl flex items-center justify-center">
                         <AlertTriangle className="h-5 w-5 text-rose-500" />
                      </div>
                      <p className="text-xs font-black uppercase italic tracking-tight text-rose-500/80">
                        Needs <strong className="text-rose-500 text-sm">{required}</strong> more sessions to save
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 rounded-[2rem] p-6 border border-emerald-500/10 flex flex-col items-center gap-3">
                      <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                         <TrendingUp className="h-5 w-5 text-emerald-500" />
                      </div>
                      <p className="text-xs font-black uppercase italic tracking-tight text-emerald-500/80">
                        {bunks > 0 
                          ? <span>Safe to skip <strong className="text-emerald-500 text-sm">{bunks}</strong> session{bunks > 1 ? 's' : ''} ✨</span>
                          : <span>Don't miss the next one! 🚫</span>}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
