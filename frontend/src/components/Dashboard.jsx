import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifySession, logoutUser } from '../services/authService';
import { checkCurrentAuthState } from '../utils/authDebugger'; 

const Dashboard = () => {
  const { currentUser, logout, checkSessionValidity, forceDashboardNavigation } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [localUser, setLocalUser] = useState(null);
  
  // ENSURE CORRECT AUTH STATE
  useEffect(() => {
    console.log('Dashboard mounted');
    
    localStorage.removeItem('authInProgress');
    
    // FUNCTION GET USER DATA 
    const getUserData = () => {
     
      if (currentUser) {
        console.log('Dashboard: Using user data from context');
        return currentUser;
      }
      
      try {
        const storedUser = sessionStorage.getItem('authenticatedUser');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log('Dashboard: Using user data from sessionStorage');
          return userData;
        }
      } catch (e) {
        console.error('Dashboard: Error reading from sessionStorage', e);
      }
      
      return null;
    };
    
    const userData = getUserData();
    
    if (userData) {
      // STORE USER DATA ON LOCAL STATE 
      setLocalUser(userData);
      setLoading(false);
      
      setTimeout(() => {
        checkSessionValidity().catch(err => {
          console.warn('Background session check failed, maintaining dashboard view:', err);
        });
      }, 2000);
    } else {
      console.log('Dashboard: No user data found in any source');
      setLoading(false);
    }
  }, [currentUser, checkSessionValidity]);
  
  const userToDisplay = currentUser || localUser;
  
  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('authenticatedUser');
      localStorage.removeItem('authInProgress');
      
      await logout();
      
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl font-semibold">Loading dashboard...</div>
      </div>
    );
  }
  
  if (!userToDisplay) {

    setTimeout(() => navigate('/login'), 100);
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
          <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300">
            Welcome, {userToDisplay.displayName || userToDisplay.username}!
          </h2>
          <p className="text-blue-600 dark:text-blue-400 mt-1">
            You are logged in with WebAuthn passkeys.
          </p>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Your Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <span className="text-gray-500 dark:text-gray-400">Username:</span> 
              <span className="ml-2 font-medium">{userToDisplay.username}</span>
            </div>
            {userToDisplay.displayName && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <span className="text-gray-500 dark:text-gray-400">Display Name:</span>
                <span className="ml-2 font-medium">{userToDisplay.displayName}</span>
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
