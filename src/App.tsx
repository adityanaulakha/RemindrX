import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import { BootScreen } from './components/ui/BootScreen';
import { PageSkeleton } from './components/ui/Skeleton';
import { useTheme } from './hooks/useTheme';

// Route-level code splitting: each page (and heavy deps like recharts on
// Super Admin) loads on demand instead of in the first bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Subjects = lazy(() => import('./pages/Subjects'));
const SubjectDetails = lazy(() => import('./pages/SubjectDetails'));
const Timeline = lazy(() => import('./pages/Timeline'));
const Events = lazy(() => import('./pages/Events'));
const Profile = lazy(() => import('./pages/Profile'));
const CRPanel = lazy(() => import('./pages/CRPanel'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const ClassUpdates = lazy(() => import('./pages/ClassUpdates'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Timetable = lazy(() => import('./pages/Timetable'));

const page = (node: React.ReactNode) => <Suspense fallback={<PageSkeleton rows={4} />}>{node}</Suspense>;

const uiPreviewEnabled = import.meta.env.DEV && import.meta.env.VITE_UI_PREVIEW === '1';
const UIPreview = uiPreviewEnabled ? lazy(() => import('./pages/UIPreview')) : null;

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) return <BootScreen />;
  if (!currentUser) return <Navigate to="/login" replace />;

  // Section comes from portal enroll auto-map. Users without a class go back to login.
  if (userData && !userData.classId && !userData.isSuperAdmin) {
    return <Navigate to="/login" replace />;
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
          <Route path="/join" element={<Navigate to="/login" replace />} />

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

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={page(<Dashboard />)} />
            <Route path="/subjects" element={page(<Subjects />)} />
            <Route path="/subjects/:id" element={page(<SubjectDetails />)} />
            <Route path="/timeline" element={page(<Timeline />)} />
            <Route path="/events" element={page(<Events />)} />
            <Route path="/updates" element={page(<ClassUpdates />)} />
            <Route path="/attendance" element={page(<Attendance />)} />
            <Route path="/timetable" element={page(<Timetable />)} />
            <Route path="/profile" element={page(<Profile />)} />
            <Route path="/cr-panel" element={page(<CRPanel />)} />
            <Route path="/super-admin" element={page(<SuperAdmin />)} />
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
