import axios from 'axios';

// USE THIS FOR DEPLOYED SERVER
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://renstack-fido2-authenticator.onrender.com';

// CONFIGURE AXIOS DEFAULTS 
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, 
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
});

// ADD REQUEST INTERCEPTOR FOR DEBUGGING
api.interceptors.request.use(
  config => {
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
      data: config.data ? (typeof config.data === 'string' ? 'String payload' : config.data) : 'No data'
    });
    
    // ENSURE METHOD IS UPPERCASE
    config.method = config.method.toLowerCase();
    
    // CUSTOM HEADER FOR SESSION TRACKING 
    const sessionId = sessionStorage.getItem('sessionId');
    if (sessionId) {
      config.headers['X-Session-ID'] = sessionId;
    }
    
    return config;
  },
  error => {
    console.error('Request config error:', error.message);
    return Promise.reject(error);
  }
);

// RESPONSE INTERCEPTOR FOR BETTER ERROR HANDLING 
api.interceptors.response.use(
  response => {
    console.log(`Response from ${response.config.url}: Status ${response.status}`);
    return response;
  },
  error => {
  
    console.error('API request failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 404) {
        const url = error.config.url;
        console.error(`404 Not Found: The endpoint "${url}" doesn't exist or is not accessible.`);
        console.error('Check: 1) API base URL is correct 2) Endpoint path is correct 3) Server is running');
      }
    } else if (error.request) {
      console.error('No response received. Check if server is running.');
    }
    
    return Promise.reject(error);
  }
);

api.checkConnection = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/`);
    return {
      connected: true,
      message: response.data || 'Connected to server',
      baseUrl: BASE_URL
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      baseUrl: BASE_URL
    };
  }
};

export default api;
