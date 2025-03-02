import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create the context
const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await axios.get('http://localhost:3001/auth/status', { 
          withCredentials: true 
        });
        if (res.data.authenticated) {
          setUser(res.data.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Login function
  const login = (userData) => {
    console.log('Setting user in context (login):', userData);
    setUser(userData);
  };

  // Register function
  const register = (userData) => {
    console.log('Setting user in context (register):', userData);
    setUser(userData);
  };

  // Logout function
  const logout = () => {
    setUser(null);
  };

  // Context value
  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
