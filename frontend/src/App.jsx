import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';

// Fixed ProtectedRoute with more reliable auth checking
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, currentUser } = useAuth();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(true);
  
  // More reliable auth check function
  const checkAuthentication = useCallback(() => {
    // First check context
    if (isAuthenticated && currentUser) {
      console.log('ProtectedRoute: Authenticated via context');
      return true;
    }
    
    // Then check sessionStorage as backup
    try {
      const storedUser = sessionStorage.getItem('authenticatedUser');
      if (storedUser) {
        console.log('ProtectedRoute: Authenticated via sessionStorage');
        return true;
      }
    } catch (e) {
      console.error('ProtectedRoute: Error reading sessionStorage', e);
    }
    
    // Also check if auth is in progress (set by Login/Register)
    if (localStorage.getItem('authInProgress') === 'true') {
      console.log('ProtectedRoute: Auth in progress flag found');
      return true;
    }
    
    console.log('ProtectedRoute: Not authenticated');
    return false;
  }, [isAuthenticated, currentUser]);
  
  // Effect to handle auth check
  useEffect(() => {
    if (!loading) {
      const isAuthed = checkAuthentication();
      
      if (!isAuthed) {
        console.log('ProtectedRoute: Not authenticated, redirecting to login');
        navigate('/login', { replace: true });
      }
      
      // Clear loading state
      setLocalLoading(false);
    }
  }, [loading, checkAuthentication, navigate]);
  
  // Show loading screen during authentication check
  if (loading || localLoading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-xl">Loading dashboard...</div>
    </div>;
  }
  
  // If we got here, we're authenticated
  return children;
};

// PublicRoute component (simplified to prevent false redirects)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  // Check for authentication in BOTH context and session storage
  const hasStoredAuth = () => {
    try {
      return !!sessionStorage.getItem('authenticatedUser');
    } catch (e) {
      return false;
    }
  };
  
  // Effect to handle redirect to dashboard if authenticated
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated || hasStoredAuth()) {
        console.log('User authenticated while on public route, redirecting to dashboard');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate]);
  
  // Always render children - the effect will handle redirection
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
