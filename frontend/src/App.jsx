import React, { useEffect } from 'react';
import { Routes, Route, Navigate, BrowserRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';

// Fixed ProtectedRoute that guarantees access to dashboard when authenticated
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  // Critical check: explicitly look for session storage auth data
  const isAuthedInStorage = () => {
    try {
      return !!sessionStorage.getItem('authenticatedUser');
    } catch (e) {
      return false;
    }
  };
  
  // Show loading during auth check
  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="text-xl">Loading dashboard...</div>
    </div>;
  }
  
  // THIS IS THE KEY FIX: Only redirect if BOTH checks fail
  if (!isAuthenticated && !isAuthedInStorage()) {
    console.log('Not authenticated by any method, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  // If we get here, user is authenticated (by either context or storage)
  console.log('User is authenticated, showing dashboard');
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
