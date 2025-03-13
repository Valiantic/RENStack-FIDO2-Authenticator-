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

  // More reliable initial auth check that prioritizes session storage
  useEffect(() => {
    const checkAuth = async () => {
      console.log('AuthContext: Initial auth check');
      
      // Try to get user from sessionStorage first
      try {
        const storedUser = sessionStorage.getItem('authenticatedUser');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log('AuthContext: Found user in sessionStorage', userData);
          setCurrentUser(userData);
          setLoading(false);
          setAuthChecked(true);
          return;
        }
      } catch (e) {
        console.error('AuthContext: Error reading sessionStorage', e);
      }
      
      // No sessionStorage user, try server check
      try {
        console.log('AuthContext: Checking with server');
        const result = await verifySession();
        
        if (result.authenticated && result.user) {
          console.log('AuthContext: Server authenticated user', result.user);
          setCurrentUser(result.user);
          // Save to sessionStorage for future checks
          sessionStorage.setItem('authenticatedUser', JSON.stringify(result.user));
        } else {
          console.log('AuthContext: Server says not authenticated');
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('AuthContext: Server check failed', err);
        setCurrentUser(null);
      }
      
      setLoading(false);
      setAuthChecked(true);
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
