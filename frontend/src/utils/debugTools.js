/**
 * Utility to check server connectivity and available routes
 */
import api from '../services/api';

// Check server connectivity
export const checkServerStatus = async () => {
  try {
    const result = await api.checkConnection();
    console.log('Server connection check:', result);
    return result;
  } catch (error) {
    console.error('Server connection check failed:', error);
    return { connected: false, error: error.message };
  }
};

// Check if specific auth endpoints are available
export const checkAuthEndpoints = async () => {
  const endpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/login/response',
    '/auth/register/response',
    '/auth/verify-session'
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    try {
      const result = await api.get(`/check-route${endpoint}`);
      results[endpoint] = { status: 'available', data: result.data };
    } catch (error) {
      results[endpoint] = { 
        status: 'error', 
        error: error.message,
        statusCode: error.response?.status 
      };
    }
  }
  
  console.log('Auth endpoints check:', results);
  return results;
};
