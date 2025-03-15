import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';

// FIXED PROTETED ROUTE
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, currentUser, checkSessionValidity } = useAuth();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(true);
  
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
  
  useEffect(() => {
    if (!loading) {
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
  

  useEffect(() => {
    if (!loading && !localLoading && isAuthenticated) {
      const serverCheckTimer = setTimeout(() => {

        checkSessionValidity().catch(err => {
          console.warn('Server verification error (non-blocking):', err);
        });
      }, 1000); // 1 second delay before server check
      
      return () => clearTimeout(serverCheckTimer);
    }
  }, [loading, localLoading, isAuthenticated, checkSessionValidity]);
  
  if (loading || localLoading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-xl">Loading Dashboard...</div>
    </div>;
  }
  
  return children;
};

// PublicRoute COMPONENT TO PREVENT REDIRECTING
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  const hasStoredAuth = () => {
    try {
      return !!sessionStorage.getItem('authenticatedUser');
    } catch (e) {
      return false;
    }
  };
  
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated || hasStoredAuth()) {
        console.log('User authenticated while on public route, redirecting to dashboard');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate]);
  
  return children;
};

function AppRoutes() {
  const { loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center">
      <div className="text-xl text-blue-600 font-semibold">Hang in there...</div>
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
