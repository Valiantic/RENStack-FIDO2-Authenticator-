import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { verifySession, logoutUser } from '../services/authService';

const AuthContext = createContext(null);

// Remove the navigation wrapper - we'll handle navigation in components instead
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Logout function without navigation
  const logout = useCallback(async () => {
    try {
      console.log('Logging out...');
      
      // Clear session storage
      sessionStorage.removeItem('authenticatedUser');
      
      // Clear server session
      await logoutUser();
      
      // Update state
      setCurrentUser(null);
      
      console.log('Logout successful');
      // Navigation will be handled by the component that calls this function
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local user data even if server logout fails
      setCurrentUser(null);
      sessionStorage.removeItem('authenticatedUser');
    }
  }, []);

  // Check session (without redirection)
  const checkSessionValidity = useCallback(async () => {
    if (!currentUser) return false;
    
    try {
      console.log('Verifying session validity...');
      const result = await verifySession();
      
      if (!result.authenticated) {
        console.log('Session expired or invalid');
        // Clear authentication state
        sessionStorage.removeItem('authenticatedUser');
        setCurrentUser(null);
        return false;
      } else {
        console.log('Session is valid');
        return true;
      }
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  }, [currentUser]);

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
        checkSessionValidity(); // Note: this doesn't redirect anymore
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
    checkSessionValidity // Export so components can trigger a manual check & handle redirection
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
