import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { verifySession, logoutUser } from '../services/authService';

const AuthContext = createContext(null);

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

  // Modified check session function to be more resilient
  const checkSessionValidity = useCallback(async () => {
    try {
      console.log('Verifying session validity...');
      
      // First check local storage before hitting the server
      const storedUser = sessionStorage.getItem('authenticatedUser');
      if (!storedUser) {
        console.log('No user data in session storage');
        setCurrentUser(null);
        return false;
      }
      
      // Only verify with server if we have a current user from context or storage
      const result = await verifySession();
      
      if (!result.authenticated) {
        console.log('Session expired or invalid');
        
        // CRITICAL FIX: Don't immediately clear auth state - check timestamp first
        try {
          const userData = JSON.parse(storedUser);
          const authenticatedAt = new Date(userData.authenticatedAt || 0);
          const now = new Date();
          const authAgeHours = (now - authenticatedAt) / (1000 * 60 * 60);
          
          // If authentication is recent (less than 24 hours), keep using it
          if (authAgeHours < 24) {
            console.log('Auth is less than 24 hours old, maintaining session');
            return true;
          } else {
            console.log('Auth is older than 24 hours, clearing local state');
            sessionStorage.removeItem('authenticatedUser');
            setCurrentUser(null);
          }
        } catch (e) {
          console.error('Error processing stored user data:', e);
          sessionStorage.removeItem('authenticatedUser');
          setCurrentUser(null);
        }
        return false;
      } else {
        console.log('Session is valid');
        // Update local state with latest user data
        if (result.user) {
          setCurrentUser(result.user);
          sessionStorage.setItem('authenticatedUser', JSON.stringify({
            ...result.user,
            authenticatedAt: new Date().toISOString()
          }));
        }
        return true;
      }
    } catch (error) {
      console.error('Session check error:', error);
      
      // CRITICAL FIX: Don't clear auth data on network errors
      console.log('Network/server error during session check, maintaining local auth state');
      return !!sessionStorage.getItem('authenticatedUser');
    }
  }, [setCurrentUser]);

  // Enhanced login function with navigation support
  const login = useCallback((userData) => {
    console.log('Setting authenticated user:', userData);
    
    if (!userData) {
      console.error('Attempted to login with null/undefined user data');
      return;
    }
    
    // Store user in state
    setCurrentUser(userData);
    
    // Also store in sessionStorage as backup with a timestamp
    try {
      const authData = {
        ...userData,
        authenticatedAt: new Date().toISOString(),
        shouldRedirect: true // Flag to help with redirects
      };
      
      sessionStorage.setItem('authenticatedUser', JSON.stringify(authData));
      // Set a separate flag for redirection
      sessionStorage.setItem('auth_redirect_pending', 'dashboard');
    } catch (e) {
      console.warn('Failed to store auth data in sessionStorage:', e);
    }
  }, []);

  // For registration - same as login
  const register = useCallback((userData) => {
    login(userData);
  }, [login]);

  // Improved initial auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('AuthContext: Initial auth check');
        
        // First try sessionStorage - trust it completely if found
        const storedUser = sessionStorage.getItem('authenticatedUser');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('AuthContext: Found user in sessionStorage - trusting local data');
            
            // Set the user state from local data immediately
            setCurrentUser(userData);
            setLoading(false);
            setAuthChecked(true);
            
            // Optionally verify with server in background after a delay
            setTimeout(() => {
              verifySession().catch(err => {
                console.warn('Background session verification failed:', err);
                // DON'T clear auth state on background verification failures
              });
            }, 2000);
            return;
          } catch (e) {
            console.error('Error parsing userData from sessionStorage:', e);
            sessionStorage.removeItem('authenticatedUser');
          }
        }
        
        // Only check with server if no local data exists
        try {
          console.log('AuthContext: Checking with server (no local data)');
          const result = await verifySession();
          
          if (result.authenticated && result.user) {
            console.log('AuthContext: Server authenticated user', result.user);
            setCurrentUser(result.user);
            sessionStorage.setItem('authenticatedUser', JSON.stringify(result.user));
          } else {
            console.log('AuthContext: Server says not authenticated');
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('AuthContext: Server check failed', err);
          setCurrentUser(null);
        }
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    };
    
    checkAuth();
  }, []);
  
  // Remove or modify periodic session checks to avoid disrupting the user experience
  useEffect(() => {
    if (currentUser) {
      // Add delay before first check to allow session to establish
      const initialCheckTimer = setTimeout(() => {
        checkSessionValidity().catch(err => {
          console.warn('Session validity check failed (non-critical):', err);
        });
      }, 5000); // 5 seconds after auth
      
      // Periodic checks only AFTER the initial delay
      const intervalTimer = setInterval(() => {
        checkSessionValidity().catch(err => {
          console.warn('Periodic session check failed (non-critical):', err);
        });
      }, 5 * 60 * 1000); // Every 5 minutes
      
      return () => {
        clearTimeout(initialCheckTimer);
        clearInterval(intervalTimer);
      };
    }
  }, [currentUser, checkSessionValidity]);

  // Check for pending redirects in session storage on auth state change
  useEffect(() => {
    if (currentUser && sessionStorage.getItem('auth_redirect_pending')) {
      const redirectTarget = sessionStorage.getItem('auth_redirect_pending');
      console.log(`Auth redirect pending to: ${redirectTarget}`);
      
      // Clear the redirect flag
      sessionStorage.removeItem('auth_redirect_pending');
    }
  }, [currentUser]);

  // Function to force dashboard navigation - can be called from any component
  const forceDashboardNavigation = useCallback(() => {
    console.log('Forcing navigation to dashboard...');
    window.location.href = '/dashboard';
  }, []);

  const value = {
    currentUser,
    authChecked,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!currentUser,
    checkSessionValidity,
    forceDashboardNavigation // Add this function to context
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
