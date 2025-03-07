import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../services/authService';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  console.log('Current user in Dashboard:', user);

  const handleLogout = async () => {
    try {
      await logoutUser();
      logout(); // Clear user from context
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show not authenticated message if no user
  if (!user) {
    return (
      <div className="text-center p-4 bg-yellow-100 text-yellow-800 rounded-lg shadow">
        Not authenticated. Redirecting to login...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 m-4">
      <h1 className="text-3xl text-center font-bold text-gray-900 dark:text-white mb-4">
        Welcome, {user?.displayName || user?.username || 'User'}!
      </h1>
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-6">
        <p className="text-lg mb-4 text-gray-700 dark:text-gray-300">
          You are now authenticated and logged in.
        </p>
        <div className="space-y-2">
          <p className="font-medium text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">Username:</span> {user?.username || 'Not available'}
          </p>
          <p className="font-medium text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">Display Name:</span> {user?.displayName || 'Not available'}
          </p>
        </div>
      </div>
      <button 
        onClick={handleLogout}
        className="w-full bg-blue-500 hover:bg-blue-600 !important text-white font-bold py-2 px-4 rounded-lg transition duration-200"
      >
        Logout
      </button>
    </div>
  );
};

export default Dashboard;
