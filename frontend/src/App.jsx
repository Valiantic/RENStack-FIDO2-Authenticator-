import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';

// Fixed ProtectedRoute with delay before server verification
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, currentUser } = useAuth();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(true);
  const [serverCheckComplete, setServerCheckComplete] = useState(false);
  
  // Check auth state from sessionStorage
  const checkSessionStorage = useCallback(() => {
    try {
      const storedUser = sessionStorage.getItem('authenticatedUser');
      if (storedUser) {
        console.log('ProtectedRoute: Found auth in sessionStorage');
        return true;
      }
    } catch (e) {
      console.error('Error reading sessionStorage:', e);
    }
    return false;
  }, []);
  
  // First effect to handle initial auth check from local storage only
  useEffect(() => {
    if (!loading) {
      // CRITICAL: First check is only from local sources (no server check)
      const isLocallyAuthenticated = isAuthenticated || checkSessionStorage();
      
      if (!isLocallyAuthenticated) {
        console.log('ProtectedRoute: No local authentication found, redirecting to login');
        navigate('/login', { replace: true });
      } else {
        console.log('ProtectedRoute: Local authentication found, allowing access');
        setLocalLoading(false);
      }
    }
  }, [loading, isAuthenticated, navigate, checkSessionStorage]);
  
  // Second effect to verify with server AFTER a delay (don't redirect on failure)
  useEffect(() => {
    if (!loading && !localLoading && isAuthenticated) {
      // Give the server time to establish the session before checking
      const serverCheckTimer = setTimeout(async () => {
        try {
          // This is only for verification, not for redirecting
          console.log('ProtectedRoute: Verifying session with server after delay');
          const { checkSessionValidity } = useAuth();
          await checkSessionValidity();
        } catch (error) {
          console.warn('Server verification error (non-blocking):', error);
        } finally {
          setServerCheckComplete(true);
        }
      }, 1000); // 1 second delay before server check
      
      return () => clearTimeout(serverCheckTimer);
    }
  }, [loading, localLoading, isAuthenticated]);
  
  if (loading || localLoading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-xl">Loading dashboard...</div>
    </div>;
  }
  
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
