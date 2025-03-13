import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifySession, logoutUser } from '../services/authService';

const Dashboard = () => {
  const { currentUser, logout, checkSessionValidity } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Verify session when component mounts
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        console.log('Dashboard: Verifying session...');
        
        const isValid = await checkSessionValidity();
        if (!isValid) {
          console.warn('Dashboard: Session is invalid, redirecting to login');
          navigate('/login');
        }
      } catch (error) {
        console.error('Dashboard: Session verification error:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
    
    // Set up periodic checks
    const interval = setInterval(async () => {
      const isValid = await checkSessionValidity();
      if (!isValid) navigate('/login');
    }, 60000); // Check every minute while on dashboard
    
    return () => clearInterval(interval);
  }, [checkSessionValidity, navigate]);
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation even if logout fails
      navigate('/login');
    }
  };
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl font-semibold">Loading dashboard...</div>
      </div>
    );
  }
  
  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl font-semibold">Session expired. Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
        
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Welcome, {currentUser.displayName || currentUser.username}!</h2>
          <p className="text-blue-600 dark:text-blue-400 mt-1">
            You are logged in with WebAuthn passkeys.
          </p>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Your Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <span className="text-gray-500 dark:text-gray-400">Username:</span> 
              <span className="ml-2 font-medium">{currentUser.username}</span>
            </div>
            {currentUser.displayName && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <span className="text-gray-500 dark:text-gray-400">Display Name:</span>
                <span className="ml-2 font-medium">{currentUser.displayName}</span>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
