import React, { useEffect } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';


// Protected route component with enhanced session validation
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Check both context auth state and session storage
  const checkAuthFromStorage = () => {
    const storedUser = sessionStorage.getItem('authenticatedUser');
    return !!storedUser;
  };
  
  // Show loading while checking auth
  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-xl">Loading...</div>
    </div>;
  }
  
  // Extra validation beyond the context
  const hasAuthInStorage = checkAuthFromStorage();
  
  // Redirect to login if not authenticated by any means
  if (!isAuthenticated && !hasAuthInStorage) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  // If authenticated but we hit a 404 on the dashboard, fix the route
  useEffect(() => {
    if (isAuthenticated) {
      // Check if we're on a route that should be valid but might 404
      const path = window.location.pathname;
      if (path === '/dashboard' && window.location.href.includes('404')) {
        console.error('Dashboard route causing 404, trying to fix...');
        window.location.replace('/dashboard');
      }
    }
  }, [isAuthenticated]);
  
  // Render children if authenticated
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
