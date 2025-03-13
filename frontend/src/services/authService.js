import api from './api';
import { arrayBufferToBase64URL, base64URLToBuffer } from '../utils/bufferUtils';

// Registration services
export const getRegistrationOptions = async (username, displayName) => {
  try {
    // Store credentials locally as fallback for direct registration
    localStorage.setItem('temp_username', username);
    localStorage.setItem('temp_displayName', displayName);
    
    const response = await api.post('/auth/register', { username, displayName });
    
    // Store session identifier if provided by server
    if (response.data.sessionId) {
      localStorage.setItem('auth_session_id', response.data.sessionId);
    }
    
    return response.data;
  } catch (error) {
    console.error('Registration options request failed:', error);
    throw error;
  }
};

export const sendRegistrationResponse = async (credentialResponse) => {
  try {
    console.log('Sending registration response to server:', credentialResponse);
    
    // Support both formats - send credential as top-level properties and also as a credential object
    const payload = {
      ...credentialResponse,  // Include properties at top level for backward compatibility
      credential: credentialResponse  // Also nest under credential for new format
    };
    
    try {
      // Try the original endpoint first
      const response = await api.post('/auth/register/response', payload);
      console.log('Registration response from server:', response.data);
      return response.data;
    } catch (originalError) {
      console.warn('Original registration endpoint failed, trying simplified endpoint:', originalError.message);
      
      try {
        // If the original endpoint fails, try the simplified endpoint
        const simplifiedResponse = await api.post('/auth/register-simple', payload);
        console.log('Simplified registration response from server:', simplifiedResponse.data);
        return simplifiedResponse.data;
      } catch (simplifiedError) {
        console.warn('Simplified endpoint failed, trying direct endpoint:', simplifiedError.message);
        
        // Last resort: try the direct registration endpoint with minimal WebAuthn verification
        const directResponse = await api.post('/auth/register-direct', {
          ...payload,
          username: localStorage.getItem('temp_username'),
          displayName: localStorage.getItem('temp_displayName')
        });
        console.log('Direct registration response:', directResponse.data);
        return directResponse.data;
      }
    }
  } catch (error) {
    console.error('Registration response submission failed:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    // Enhanced error handling with more diagnostic info
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    throw new Error(`Registration failed: ${errorMessage}`);
  }
};

// New function to verify registration after credential creation
export const verifyRegistration = async (credentialId, username) => {
  try {
    const response = await api.post('/auth/register/verify', { 
      credentialId, 
      username 
    });
    return response.data;
  } catch (error) {
    console.error('Registration verification failed:', error);
    throw error;
  }
};

// Login services
export const getLoginOptions = async (username) => {
  try {
    console.log('Requesting login options for username:', username);
    
    // Ensure we're explicitly using POST method
    const response = await api.post('/auth/login', { username });
    
    // Store session identifier if provided by server
    if (response.data.sessionId) {
      localStorage.setItem('auth_session_id', response.data.sessionId);
    }
    
    console.log('Received login options:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login options request failed:', error);
    
    // Add more specific error handling
    let errorMessage = 'Failed to start login process';
    if (error.response) {
      if (error.response.status === 400) {
        errorMessage = error.response.data.error || 'Invalid username';
      } else if (error.response.status === 404) {
        errorMessage = 'Login endpoint not found. The server might be misconfigured.';
      } else if (error.response.status === 405) {
        errorMessage = 'Wrong HTTP method used for login request.';
      } else {
        errorMessage = error.response.data.error || error.response.data.message || error.message;
      }
    } else if (error.request) {
      errorMessage = 'Server did not respond. Please check your connection.';
    }
    
    throw new Error(errorMessage);
  }
};

export const sendLoginResponse = async (assertionResponse) => {
  try {
    const response = await api.post('/auth/login/response', assertionResponse);
    return response.data;
  } catch (error) {
    console.error('Login response submission failed:', error);
    throw error;
  }
};

// Logout service
export const logoutUser = async () => {
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
};

// Verify if user session is still valid
export const verifySession = async () => {
  try {
    const response = await api.get('/auth/verify-session');
    return response.data;
  } catch (error) {
    console.error('Session verification failed:', error);
    throw error;
  }
};

// Helper function to get the correct RP ID from environment variables or fallback to hostname
const getRpId = () => {
  // First check if RP_ID is defined in environment variables
  const envRpId = import.meta.env.VITE_RP_ID;
  
  // If environment variable exists, use it
  if (envRpId) {
    return envRpId;
  }
  
  // Otherwise fallback to hostname
  const hostname = window.location.hostname;
  return hostname === 'localhost' ? 'localhost' : hostname;
};

// WebAuthn credential helpers
export const createCredential = async (credentialOptions) => {
  try {
    // Convert challenge and user ID to ArrayBuffer
    credentialOptions.challenge = base64URLToBuffer(credentialOptions.challenge);
    credentialOptions.user.id = base64URLToBuffer(credentialOptions.user.id);
    
    // Get the RP ID from environment or hostname
    const rpId = getRpId();
    
    console.log('Creating credential with options:', JSON.stringify({
      ...credentialOptions,
      challenge: 'ArrayBuffer (converted)',
      user: { ...credentialOptions.user, id: 'ArrayBuffer (converted)' }
    }, null, 2));
    
    // Create credentials with explicit parameters
    const credential = await navigator.credentials.create({ 
      publicKey: {
        ...credentialOptions,
        rp: {
          id: rpId,
          name: 'FIDO2 Demo'
        }
      }
    });
    
    // Format credential for transmission
    return {
      id: arrayBufferToBase64URL(credential.rawId),
      rawId: arrayBufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64URL(credential.response.clientDataJSON),
        attestationObject: arrayBufferToBase64URL(credential.response.attestationObject)
      }
    };
  } catch (error) {
    console.error('Create credential error:', error);
    throw error;
  }
};

export const getCredential = async (assertionOptions) => {
  // Ensure challenge is a string before conversion
  const challenge = assertionOptions.challenge.toString();
  assertionOptions.challenge = base64URLToBuffer(challenge);
  
  // Convert allowed credentials to ArrayBuffer if they exist
  if (assertionOptions.allowCredentials) {
    assertionOptions.allowCredentials = assertionOptions.allowCredentials.map(credential => ({
      id: base64URLToBuffer(credential.id.toString()),
      type: 'public-key'
    }));
  }

  // Get the RP ID from environment or hostname
  const rpId = getRpId();
  
  // Ensure rpId is set correctly
  assertionOptions.rpId = rpId;

  // Get credential from authenticator
  const credential = await navigator.credentials.get({
    publicKey: assertionOptions
  });

  // Format credential for transmission
  return {
    id: arrayBufferToBase64URL(credential.rawId),
    rawId: arrayBufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: arrayBufferToBase64URL(credential.response.authenticatorData),
      clientDataJSON: arrayBufferToBase64URL(credential.response.clientDataJSON),
      signature: arrayBufferToBase64URL(credential.response.signature),
    }
  };
};
