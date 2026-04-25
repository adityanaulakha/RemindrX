import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { User, ClassData } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Calendar, CheckCircle, XCircle, Users, BookOpen, Search, Plus, Edit2, Trash2, ShieldAlert, UserMinus, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { calculateTrustScore } from '../utils/trustScore';

export default function AdminPanel() {
  const { userData, currentUser } = useAuth();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [trustScores, setTrustScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, [userData]);

  const fetchAdminData = async () => {
    if (!userData?.classId || userData.role !== 'admin') return;

    try {
      // Fetch Class Data
      const classSnap = await getDocs(query(collection(db, 'classes'), where('__name__', '==', userData.classId)));
      if (!classSnap.empty) {
        setClassData({ id: classSnap.docs[0].id, ...classSnap.docs[0].data() } as ClassData);
      }

      // Fetch Students
      const q = query(collection(db, 'users'), where('classId', '==', userData.classId));
      const studentSnap = await getDocs(q);
      const fetchedStudents = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setStudents(fetchedStudents);
      
      // Compute trust scores
      const scores: Record<string, number> = {};
      await Promise.all(fetchedStudents.map(async (student) => {
        scores[student.id] = await calculateTrustScore(student.id);
      }));
      setTrustScores(scores);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoteAdmin = async (userId: string) => {
    if (userId === currentUser?.uid) {
      toast.error("You cannot demote yourself.");
      return;
    }
    if (!classData || !window.confirm("Are you sure you want to demote this admin to a student?")) return;

    try {
      // 1. Remove from class admins array
      await updateDoc(doc(db, 'classes', classData.id), {
        admins: arrayRemove(userId)
      });
      
      // 2. Update user role
      await updateDoc(doc(db, 'users', userId), {
        role: 'student'
      });

      toast.success("Admin demoted successfully");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to demote admin");
    }
  };

  if (loading || !classData) {
    return <div className="animate-pulse h-64 bg-card rounded-xl"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-danger flex items-center gap-2">
            <ShieldAlert className="h-8 w-8" /> Admin Panel
          </h1>
          <p className="text-foreground/60">Manage your class settings and members.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Class Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground/60">Class Name</p>
              <p className="text-lg font-semibold">{classData.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/60">Student Join Code</p>
              <div className="flex items-center gap-2">
                <code className="text-lg text-primary bg-primary/10 px-3 py-1 rounded-md">{classData.joinCode}</code>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground/60 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-danger" /> Admin Invite Code
              </p>
              <div className="flex items-center justify-between mt-1">
                <code className="text-lg text-danger bg-danger/10 px-3 py-1 rounded-md">{classData.adminInviteCode}</code>
                <span className="text-sm font-medium">{classData.adminCodeUses} uses left</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Class Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {students.map(student => (
                <div key={student.id} className="flex items-center justify-between p-4 bg-card">
                  <div className="flex flex-col">
                    <span className="font-semibold flex items-center gap-2">
                      {student.name}
                      {student.role === 'admin' && <ShieldCheck className="h-4 w-4 text-danger" />}
                    </span>
                    <span className="text-sm text-foreground/60">{student.email}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground/50 uppercase">Trust Score</p>
                      <p className="font-mono font-bold text-primary">{trustScores[student.id] ?? 0}</p>
                    </div>
                    {student.role === 'admin' && student.id !== currentUser?.uid && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-danger hover:text-danger hover:bg-danger/10"
                        onClick={() => handleDemoteAdmin(student.id)}
                      >
                        <UserMinus className="h-4 w-4 mr-2" /> Demote
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
