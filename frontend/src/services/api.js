import axios from 'axios';

// USE THIS FOR LOCALHOST TESTING
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Configure axios defaults
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Ensure cookies are sent with requests
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
});

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    // Log request details in development
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
      data: config.data ? (typeof config.data === 'string' ? 'String payload' : config.data) : 'No data'
    });
    
    // Ensure method is uppercase
    config.method = config.method.toLowerCase();
    
    return config;
  },
  error => {
    console.error('Request config error:', error.message);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  response => {
    console.log(`Response from ${response.config.url}: Status ${response.status}`);
    return response;
  },
  error => {
    // Log detailed error information
    console.error('API request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      // Add user-friendly messages for common login-related errors
      if (error.response.status === 404 && error.config.url.includes('/login')) {
        console.error('Login endpoint not found. Check if server is running and routes are properly configured.');
      } else if (error.response.status === 405 && error.config.url.includes('/login')) {
        console.error('Method not allowed. Make sure you are using POST for login.');
      }
    } else if (error.request) {
      console.error('No response received from server. Check network connectivity and server status.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
