import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

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
