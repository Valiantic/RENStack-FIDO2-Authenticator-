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
    return <div>Loading...</div>;
  }

  // Show not authenticated message if no user
  if (!user) {
    return <div>Not authenticated. Redirecting to login...</div>;
  }

  return (
    <div>
      <h1>Welcome, {user?.displayName || user?.username || 'User'}!</h1>
      <p>You are now authenticated and logged in.</p>
      <div>
        <p>Username: {user?.username || 'Not available'}</p>
        <p>Display Name: {user?.displayName || 'Not available'}</p>
      </div>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Dashboard;
