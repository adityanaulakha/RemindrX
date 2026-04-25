import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap } from 'lucide-react';
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

    // Check if previously connected in local storage (mock persistence)
    const storedStatus = localStorage.getItem(`attendance_${currentUser?.uid}`);
    if (storedStatus) {
      setIsConnected(true);
    }

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
    // Generate deterministic but pseudo-random attendance data based on subjects
    const data: AttendanceData[] = subjects.map((sub, index) => {
      // Base total classes between 30 and 50
      const totalClasses = 30 + (index * 5) % 20;
      // Attended classes, generating some below 75% and some above
      const attendedClasses = index % 3 === 0 ? Math.floor(totalClasses * 0.72) : Math.floor(totalClasses * (0.8 + (index * 0.02)));
      const percentage = Math.round((attendedClasses / totalClasses) * 100);
      
      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        totalClasses,
        attendedClasses,
        percentage
      };
    });
    setAttendanceData(data);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !password) return;

    setLoading(true);
    // Simulate API call to college portal
    setTimeout(() => {
      setIsConnected(true);
      localStorage.setItem(`attendance_${currentUser?.uid}`, 'true');
      setLoading(false);
      toast.success('Successfully connected to College Portal!');
    }, 2000);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      generateMockData(); // Regenerate to simulate updates
      setLoading(false);
      toast.success('Attendance synced successfully');
    }, 1000);
  };

  // Calculator: Can I Bunk?
  const calculateBunks = (attended: number, total: number, targetPercentage: number = 75) => {
    // If we attend no more classes, how many can we bunk until we drop below 75%?
    // Formula: (attended) / (total + x) >= target/100
    // attended * 100 >= target * (total + x)
    // (attended * 100 / target) - total >= x
    
    const maxTotalClasses = Math.floor((attended * 100) / targetPercentage);
    const bunksAvailable = maxTotalClasses - total;
    
    return bunksAvailable;
  };

  const calculateRequired = (attended: number, total: number, targetPercentage: number = 75) => {
    // How many consecutive classes to attend to reach 75%?
    // (attended + x) / (total + x) >= target/100
    // 100*attended + 100*x = target*total + target*x
    // x(100 - target) = target*total - 100*attended
    // x = (target*total - 100*attended) / (100 - target)
    
    if (attended / total >= targetPercentage / 100) return 0;
    
    const required = Math.ceil(((targetPercentage * total) - (100 * attended)) / (100 - targetPercentage));
    return required;
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto space-y-6">
        <div className="bg-primary/10 p-6 rounded-full mb-2">
          <GraduationCap className="h-16 w-16 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Attendance Buddy</h1>
          <p className="text-foreground/60">Connect your university portal to automatically sync your attendance and timetable.</p>
        </div>

        <Card className="w-full">
          <CardContent className="pt-6">
            <form onSubmit={handleConnect} className="space-y-4">
              <Input
                label="Student ID / Roll Number"
                type="text"
                placeholder="e.g. 21BCE10234"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />
              <Input
                label="Portal Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="bg-warning/10 p-3 rounded-lg flex items-start gap-3 mt-4 text-sm border border-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <p className="text-warning-foreground">
                  <strong>Demo Mode:</strong> Your credentials are not stored. This is a secure simulation for demonstration purposes.
                </p>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? 'Connecting securely...' : 'Connect Portal'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Buddy</h1>
          <p className="text-foreground/60 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Portal Synced
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading} className="shrink-0 flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sync Now
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {attendanceData.map((data) => {
          const isDanger = data.percentage < 75;
          const bunks = calculateBunks(data.attendedClasses, data.totalClasses);
          const required = calculateRequired(data.attendedClasses, data.totalClasses);

          return (
            <Card key={data.subjectId} className={`relative overflow-hidden ${isDanger ? 'border-danger/50' : 'border-border'}`}>
              <div className={`absolute top-0 left-0 w-1.5 h-full ${isDanger ? 'bg-danger' : 'bg-success'}`}></div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg leading-tight line-clamp-1" title={data.subjectName}>{data.subjectName}</h3>
                    <p className="text-xs text-foreground/50">{data.subjectCode}</p>
                  </div>
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full font-black text-lg shrink-0 ${
                    isDanger ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                  }`}>
                    {data.percentage}%
                  </div>
                </div>

                <div className="flex justify-between text-sm mb-4 bg-background/50 p-2 rounded-lg border border-border/50">
                  <div className="text-center flex-1 border-r border-border/50">
                    <p className="text-foreground/50 text-[10px] uppercase font-bold tracking-wider mb-1">Attended</p>
                    <p className="font-semibold">{data.attendedClasses}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-foreground/50 text-[10px] uppercase font-bold tracking-wider mb-1">Total</p>
                    <p className="font-semibold">{data.totalClasses}</p>
                  </div>
                </div>

                {isDanger ? (
                  <div className="bg-danger/10 text-danger-foreground p-3 rounded-lg text-sm flex items-start gap-2 border border-danger/20">
                    <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-danger leading-none mb-1">Shortage Alert</p>
                      <p className="text-xs">Attend the next <strong>{required}</strong> consecutive classes to reach 75%.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-success/10 text-success-foreground p-3 rounded-lg text-sm flex items-start gap-2 border border-success/20">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-success leading-none mb-1">Safe to Bunk?</p>
                      <p className="text-xs">
                        {bunks > 0 
                          ? <span>You can safely bunk <strong>{bunks}</strong> class{bunks > 1 ? 'es' : ''} and stay above 75%.</span>
                          : <span>You are exactly at 75%. Do not bunk the next class!</span>}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
