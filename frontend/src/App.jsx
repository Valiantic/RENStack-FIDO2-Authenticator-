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
  
  // Render children if authenticated
  return children;
};

// Enhanced public route component that ensures authenticated users are redirected
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
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
