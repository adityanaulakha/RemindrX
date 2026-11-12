import { lazy, Suspense } from 'react';
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
import Timetable from './pages/Timetable';
import Landing from './pages/Landing';
import Layout from './components/layout/Layout';
import { BootScreen } from './components/ui/BootScreen';
import { useTheme } from './hooks/useTheme';
import type { JSX } from 'react';

const uiPreviewEnabled = import.meta.env.DEV && import.meta.env.VITE_UI_PREVIEW === '1';
const UIPreview = uiPreviewEnabled ? lazy(() => import('./pages/UIPreview')) : null;

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <BootScreen />;
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

  if (loading) return <BootScreen />;
  if (!currentUser) return <Navigate to="/login" replace />;

  // If they already have a class or are a super admin, they shouldn't be here
  if (userData && (userData.classId || userData.isSuperAdmin)) {
    return <Navigate to={userData.isSuperAdmin ? "/super-admin" : "/dashboard"} replace />;
  }

  return children;
};

// Default redirect component
const DefaultRoute = () => {
  const { currentUser, userData, loading } = useAuth();
  if (loading) return null;

  if (!currentUser) return <Landing />;

  if (userData?.isSuperAdmin && !userData?.classId) {
    return <Navigate to="/super-admin" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

function App() {
  const { loading } = useAuth();
  useTheme();

  if (loading) {
    return <BootScreen label="Getting your campus workspace ready" />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground">
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

          {UIPreview && (
            <Route
              path="/dev/ui-preview"
              element={
                <Suspense fallback={<BootScreen label="Loading UI preview" />}>
                  <UIPreview />
                </Suspense>
              }
            />
          )}

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
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/cr-panel" element={<CRPanel />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
          </Route>

          <Route path="/" element={<DefaultRoute />} />
        </Routes>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'var(--card)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow)',
              fontSize: '14px',
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
