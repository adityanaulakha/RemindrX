import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import JoinClass from './pages/JoinClass';
import Dashboard from './pages/Dashboard';
import Subjects from './pages/Subjects';
import SubjectDetails from './pages/SubjectDetails';
import Timeline from './pages/Timeline';
import Events from './pages/Events';
import Profile from './pages/Profile';
import CRPanel from './pages/CRPanel';
import SuperAdmin from './pages/SuperAdmin';
import ClassUpdates from './pages/ClassUpdates';
import Attendance from './pages/Attendance';
import Layout from './components/layout/Layout';
import type { JSX } from 'react';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;

  // If user is logged in but hasn't joined a class, force them to join a class
  // unless they are a Super Admin
  if (userData && !userData.classId && !userData.isSuperAdmin) {
    return <Navigate to="/join" replace />;
  }

  return children;
};

// Route wrapper for users who haven't joined a class yet
const JoinClassRoute = ({ children }: { children: JSX.Element }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;

  // If they already have a class or are a super admin, they shouldn't be here
  if (userData && (userData.classId || userData.isSuperAdmin)) {
    return <Navigate to={userData.isSuperAdmin ? "/super-admin" : "/dashboard"} replace />;
  }

  return children;
};

// Default redirect component
const DefaultRoute = () => {
  const { userData, loading } = useAuth();
  if (loading) return null;

  if (userData?.isSuperAdmin && !userData?.classId) {
    return <Navigate to="/super-admin" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary animate-pulse" />
          <div className="absolute inset-0 h-16 w-16 border-4 border-primary/20 rounded-2xl animate-spin [animation-duration:3s]" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-black italic tracking-tighter uppercase">Initializing Core</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-20 animate-pulse">Syncing temporal nodes...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/join"
            element={
              <JoinClassRoute>
                <JoinClass />
              </JoinClassRoute>
            }
          />

          {/* Main App Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:id" element={<SubjectDetails />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/events" element={<Events />} />
            <Route path="/updates" element={<ClassUpdates />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/cr-panel" element={<CRPanel />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            {/* Additional routes will be added here */}
          </Route>

          <Route path="/" element={<DefaultRoute />} />
        </Routes>
        <Toaster position="bottom-right" />
      </div>
    </Router>
  );
}

export default App;
