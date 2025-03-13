import React, { createContext, useState, useContext, useEffect } from 'react';
import { verifySession, logoutUser } from '../services/authService';

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
        
        // First check session storage
        const storedUser = sessionStorage.getItem('authenticatedUser');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('Found authenticated user in session storage:', userData);
            setCurrentUser(userData);
            setLoading(false);
            setAuthChecked(true);
            return;
          } catch (e) {
            console.warn('Failed to parse stored user data:', e);
            // Continue to server check
          }
        }
        
        // Then check server session
        const result = await verifySession();
        console.log('Server auth check result:', result);
        
        if (result.authenticated && result.user) {
          console.log('User is authenticated:', result.user);
          setCurrentUser(result.user);
          sessionStorage.setItem('authenticatedUser', JSON.stringify(result.user));
        } else {
          console.log('User is not authenticated');
          setCurrentUser(null);
          sessionStorage.removeItem('authenticatedUser');
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
    
    if (!userData) {
      console.error('Attempted to login with null/undefined user data');
      return;
    }
    
    // Store user in state
    setCurrentUser(userData);
    
    // Also store in sessionStorage as backup
    try {
      sessionStorage.setItem('authenticatedUser', JSON.stringify(userData));
    } catch (e) {
      console.warn('Failed to store auth data in sessionStorage:', e);
    }
  };

  // For registration - same as login
  const register = (userData) => {
    login(userData);
  };

  // For logout
  const logout = async () => {
    try {
      console.log('Logging out...');
      
      // Clear session storage
      sessionStorage.removeItem('authenticatedUser');
      
      // Clear server session
      await logoutUser();
      
      // Update state
      setCurrentUser(null);
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local user data even if server logout fails
      setCurrentUser(null);
      sessionStorage.removeItem('authenticatedUser');
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
