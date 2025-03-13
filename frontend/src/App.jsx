import React, { useEffect } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';

// Fixed ProtectedRoute that prioritizes session storage over context
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  // Check session storage first (most reliable)
  const checkSessionStorage = () => {
    const storedUser = sessionStorage.getItem('authenticatedUser');
    const lastAction = localStorage.getItem('last_auth_action');
    
    console.log('Protected route check:', {
      storedUser: !!storedUser,
      contextAuth: isAuthenticated,
      lastAction
    });
    
    return !!storedUser;
  };
  
  // Show loading state during authentication check
  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-xl">Loading dashboard...</div>
    </div>;
  }
  
  // Check both context and session storage
  const isAuthedInStorage = checkSessionStorage();
  
  if (!isAuthenticated && !isAuthedInStorage) {
    console.log('No authentication found, redirecting to login');
    // First clear any stale data
    localStorage.removeItem('last_auth_action');
    return <Navigate to="/login" replace />;
  }
  
  // If we get here, user is authenticated
  console.log('User is authenticated, showing dashboard');
  return children;
};

// Enhanced public route component that ensures authenticated users are redirected
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  // New effect to check for 404 errors
  useEffect(() => {
    const handle404Detection = () => {
      // Check if we're getting redirect loops
      const redirectAttempts = sessionStorage.getItem('redirect_attempts') || 0;
      if (parseInt(redirectAttempts) > 3) {
        console.error('Too many redirect attempts detected. Resetting authentication state.');
        sessionStorage.clear(); // Clear all session storage to reset state
        window.location.href = '/login'; // Force back to login
        return;
      }
      
      // Track redirect attempts
      sessionStorage.setItem('redirect_attempts', parseInt(redirectAttempts) + 1);
      
      // After navigation completes, reset the counter
      return () => {
        setTimeout(() => {
          sessionStorage.setItem('redirect_attempts', '0');
        }, 1000);
      };
    };
    
    return handle404Detection();
  }, []);
  
  useEffect(() => {
    // Check for authentication in session storage as a fallback
    const hasStoredAuth = sessionStorage.getItem('authenticatedUser') !== null;
    
    // If user is authenticated but still on public route, redirect them
    if ((isAuthenticated || hasStoredAuth) && !loading) {
      console.log('User is already authenticated, redirecting from public route to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-xl">Loading...</div>
    </div>;
  }
  
  if (isAuthenticated) {
    return null; // Return nothing while redirect happens
  }
  
  return children;
};

function AppRoutes() {
  const { loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center">
      <div className="text-xl text-blue-600 font-semibold">Loading...</div>
    </div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
