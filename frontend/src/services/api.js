import axios from 'axios';

// USE THIS FOR LOCALHOST TESTING
// const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Configure axios defaults
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
});

export default api;
