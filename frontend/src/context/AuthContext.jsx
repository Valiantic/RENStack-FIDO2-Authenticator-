import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { verifySession, logoutUser } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const logout = useCallback(async () => {
    try {
      console.log('Logging out...');
      
      sessionStorage.removeItem('authenticatedUser');
      
      await logoutUser();
      
      setCurrentUser(null);
      
      console.log('Logout successful');
  
    } catch (error) {
      console.error('Logout error:', error);

      setCurrentUser(null);
      sessionStorage.removeItem('authenticatedUser');
    }
  }, []);


  const checkSessionValidity = useCallback(async () => {
    try {
      console.log('Verifying session validity...');
      
      const storedUser = sessionStorage.getItem('authenticatedUser');
      if (!storedUser) {
        console.log('No user data in session storage');
        setCurrentUser(null);
        return false;
      }
      
      const result = await verifySession();
      
      if (!result.authenticated) {
        console.log('Session expired or invalid');
        
        try {
          const userData = JSON.parse(storedUser);
          const authenticatedAt = new Date(userData.authenticatedAt || 0);
          const now = new Date();
          const authAgeHours = (now - authenticatedAt) / (1000 * 60 * 60);
          
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
      
      console.log('Network/server error during session check, maintaining local auth state');
      return !!sessionStorage.getItem('authenticatedUser');
    }
  }, [setCurrentUser]);

  const login = useCallback((userData) => {
    console.log('Setting authenticated user:', userData);
    
    if (!userData) {
      console.error('Attempted to login with null/undefined user data');
      return;
    }
    
    setCurrentUser(userData);
    
    try {
      const authData = {
        ...userData,
        authenticatedAt: new Date().toISOString(),
        shouldRedirect: true 
      };
      
      sessionStorage.setItem('authenticatedUser', JSON.stringify(authData));   
      sessionStorage.setItem('auth_redirect_pending', 'dashboard');
    } catch (e) {
      console.warn('Failed to store auth data in sessionStorage:', e);
    }
  }, []);


  const register = useCallback((userData) => {
    login(userData);
  }, [login]);


  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('AuthContext: Initial auth check');
        
        const storedUser = sessionStorage.getItem('authenticatedUser');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            console.log('AuthContext: Found user in sessionStorage - trusting local data');
            
            setCurrentUser(userData);
            setLoading(false);
            setAuthChecked(true);
            
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
    
      const initialCheckTimer = setTimeout(() => {
        checkSessionValidity().catch(err => {
          console.warn('Session validity check failed (non-critical):', err);
        });
      }, 5000); // 5 seconds after auth
      
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

  useEffect(() => {
    if (currentUser && sessionStorage.getItem('auth_redirect_pending')) {
      const redirectTarget = sessionStorage.getItem('auth_redirect_pending');
      console.log(`Auth redirect pending to: ${redirectTarget}`);
      
      sessionStorage.removeItem('auth_redirect_pending');
    }
  }, [currentUser]);

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
    forceDashboardNavigation 
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
