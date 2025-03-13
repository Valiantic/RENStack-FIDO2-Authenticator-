import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { verifySession, logoutUser } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

// Wrapper component that has access to navigation
const AuthProviderWithNavigation = ({ children }) => {
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Logout function that can navigate
  const logout = useCallback(async () => {
    try {
      console.log('Logging out...');
      
      // Clear session storage
      sessionStorage.removeItem('authenticatedUser');
      
      // Clear server session
      await logoutUser();
      
      // Update state
      setCurrentUser(null);
      
      console.log('Logout successful, redirecting to login');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local user data even if server logout fails
      setCurrentUser(null);
      sessionStorage.removeItem('authenticatedUser');
      navigate('/login');
    }
  }, [navigate]);

  // Check session and redirect if needed
  const checkSessionValidity = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      console.log('Verifying session validity...');
      const result = await verifySession();
      
      if (!result.authenticated) {
        console.log('Session expired or invalid, logging out');
        await logout();
      } else {
        console.log('Session is valid');
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  }, [currentUser, logout]);

  // Login function called after successful authentication
  const login = useCallback((userData) => {
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
  }, []);

  // For registration - same as login
  const register = useCallback((userData) => {
    login(userData);
  }, [login]);

  // Initial auth check on component mount
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
            
            // Verify session with server in the background
            try {
              const result = await verifySession();
              if (!result.authenticated) {
                console.warn('Session storage user not verified by server, removing');
                sessionStorage.removeItem('authenticatedUser');
                setCurrentUser(null);
              } else {
                console.log('Server confirmed user is authenticated');
                // Update with the latest user data from server
                setCurrentUser(result.user);
                sessionStorage.setItem('authenticatedUser', JSON.stringify(result.user));
              }
            } catch (verifyError) {
              console.error('Error verifying session with server:', verifyError);
              // Keep using the local session data for now
            }
          } catch (e) {
            console.warn('Failed to parse stored user data:', e);
            sessionStorage.removeItem('authenticatedUser');
          }
        } else {
          // No local session, check with server
          try {
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
          } catch (serverError) {
            console.error('Server auth check error:', serverError);
            setCurrentUser(null);
            sessionStorage.removeItem('authenticatedUser');
          }
        }
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);
  
  // Session persistence effect - replaces SessionPersistence component
  useEffect(() => {
    // Check session validity on initial load if user is logged in
    if (currentUser) {
      checkSessionValidity();
    }
    
    // Set up periodic session checks
    const sessionCheckInterval = setInterval(() => {
      if (currentUser) {
        checkSessionValidity();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    // Cleanup interval on unmount
    return () => clearInterval(sessionCheckInterval);
  }, [currentUser, checkSessionValidity]);

  const value = {
    currentUser,
    authChecked,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!currentUser,
    checkSessionValidity // Export this so components can trigger a manual check
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Main Provider component
export const AuthProvider = ({ children }) => {
  return <AuthProviderWithNavigation>{children}</AuthProviderWithNavigation>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
