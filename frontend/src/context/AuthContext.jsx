import React, { createContext, useState, useContext, useEffect } from 'react';
import { verifySession } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Check for existing session on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        const result = await verifySession();
        
        console.log('Auth check result:', result);
        
        if (result.authenticated && result.user) {
          console.log('User is authenticated:', result.user);
          setCurrentUser(result.user);
        } else {
          console.log('User is not authenticated');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  // Login function called after successful authentication
  const login = (userData) => {
    console.log('Setting authenticated user:', userData);
    setCurrentUser(userData);
    
    // Store user data in sessionStorage as backup
    try {
      sessionStorage.setItem('authenticatedUser', JSON.stringify(userData));
    } catch (e) {
      console.warn('Failed to store auth data in sessionStorage:', e);
    }
  };

  // For registration
  const register = (userData) => {
    login(userData); // Use the same logic as login
  };

  // For logout
  const logout = async () => {
    try {
      // Clear session storage
      sessionStorage.removeItem('authenticatedUser');
      
      // Clear server session
      await logoutUser(); // Import this from authService
      
      // Update state
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    currentUser,
    authChecked,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!currentUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
