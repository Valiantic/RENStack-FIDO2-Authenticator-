import api from './api';
import { arrayBufferToBase64URL, base64URLToBuffer } from '../utils/bufferUtils';

// Registration services
export const getRegistrationOptions = async (username, displayName) => {
  try {
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
    // Get session identifier if available
    const sessionId = localStorage.getItem('auth_session_id');
    
    // Include session identifier in request if available
    const payload = {
      ...credentialResponse,
      sessionId
    };
    
    const response = await api.post('/auth/register/response', payload);
    
    // Clean up session identifier after use
    localStorage.removeItem('auth_session_id');
    
    return response.data;
  } catch (error) {
    console.error('Registration response submission failed:', error);
    throw error;
  }
};

// Login services
export const getLoginOptions = async (username) => {
  try {
    const response = await api.post('/auth/login', { username });
    
    // Store session identifier if provided by server
    if (response.data.sessionId) {
      localStorage.setItem('auth_session_id', response.data.sessionId);
    }
    
    return response.data;
  } catch (error) {
    console.error('Login options request failed:', error);
    throw error;
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
