import React, { createContext, useContext, useState, useEffect } from 'react';
import { verifySession } from '../services/authService';

// Create context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on initial load
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const response = await verifySession();
        
        if (response.authenticated && response.user) {
          setUser(response.user);
        }
      } catch (error) {
        console.error('Error verifying session:', error);
      } finally {
        setLoading(false);
      }
    }
    
    checkExistingSession();
  }, []);

  // Login function
  const login = (userData) => {
    setUser(userData);
  };

  // Register function
  const register = (userData) => {
    setUser(userData);
  };

  // Logout function
  const logout = () => {
    setUser(null);
  };

  // Context value
  const value = {
    user,
    loading,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using auth context
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
