import axios from 'axios';

// USE THIS FOR LOCALHOST TESTING
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// const BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
    if (import.meta.env.DEV) {
      console.log('API Request:', {
        url: config.url,
        method: config.method,
        data: config.data,
        headers: config.headers
      });
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // Log detailed error information
    console.error('API request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
