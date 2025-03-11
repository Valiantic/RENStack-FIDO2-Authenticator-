import axios from 'axios';

// Get the API URL from environment or fallback
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

console.log('API configured to use BASE_URL:', BASE_URL);

// Configure axios defaults
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  // Add explicit timeout
  timeout: 10000
});

// Add request interceptor for debugging
api.interceptors.request.use(config => {
  console.log(`Making ${config.method.toUpperCase()} request to: ${config.baseURL}${config.url}`);
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
