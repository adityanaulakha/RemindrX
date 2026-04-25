import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import JoinClass from './pages/JoinClass';
import Dashboard from './pages/Dashboard';
import Subjects from './pages/Subjects';
import SubjectDetails from './pages/SubjectDetails';
import Timeline from './pages/Timeline';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import Layout from './components/layout/Layout';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, userData, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  
  // If user is logged in but hasn't joined a class, force them to join a class
  if (userData && !userData.classId) {
    return <Navigate to="/join" replace />;
  }
  
  return children;
};

// Route wrapper for users who haven't joined a class yet
const JoinClassRoute = ({ children }: { children: JSX.Element }) => {
  const { currentUser, userData, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  
  // If they already have a class, they shouldn't be here
  if (userData && userData.classId) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminPanel />} />
            {/* Additional routes will be added here */}
          </Route>
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-center" />
      </div>
    </Router>
  );
}

export default App;
