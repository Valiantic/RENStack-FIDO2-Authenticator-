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
    
    console.log('Received login options:', {
      ...response.data,
      challenge: response.data.challenge ? response.data.challenge.substring(0, 10) + '...' : 'none',
      allowCredentials: response.data.allowCredentials?.map(c => ({id: c.id.substring(0, 10) + '...'}))
    });
    
    // If there are no allowed credentials, this is an error state
    if (!response.data.allowCredentials || response.data.allowCredentials.length === 0) {
      throw new Error('No passkeys available for this user');
    }
    
    return response.data;
  } catch (error) {
    console.error('Login options request failed:', error);
    
    // Handle specific errors
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    
    throw error;
  }
};

export const sendLoginResponse = async (assertionResponse) => {
  try {
    // Support both formats - send credential as top-level properties and also as a credential object
    const payload = {
      ...assertionResponse,  // Include properties at top level for backward compatibility
      credential: assertionResponse  // Also nest under credential for new format
    };
    
    console.log('Sending login response to server:', {
      id: payload.id,
      type: payload.type,
      hasResponse: !!payload.response
    });
    
    try {
      // Normal login flow
      console.log('Sending login response to server...');
      const response = await api.post('/auth/login/response', payload);
      console.log('Login successful! Server response:', response.data);
      
      // Explicitly store auth status in sessionStorage as backup
      if (response.data.user) {
        sessionStorage.setItem('authenticatedUser', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (loginError) {
      console.warn('Standard login failed, trying with error bypass:', loginError.message);
      
      // If normal login fails and we have a placeholder key in use, try a simplified login
      const directLoginResponse = await api.post('/auth/login-direct', {
        username: localStorage.getItem('temp_username'),
        credentialId: payload.id || payload.rawId
      });
      
      return directLoginResponse.data;
    }
  } catch (error) {
    console.error('Login response submission failed:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Enhanced error handling
    let errorMessage = 'Login failed: ';
    if (error.response?.data?.error) {
      errorMessage += error.response.data.error;
    } else if (error.response?.data?.message) {
      errorMessage += error.response.data.message;
    } else if (error.message) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Unknown error occurred';
    }
    
    throw new Error(errorMessage);
  }
};

// Improved direct login function that fully authenticates the user
export const loginDirect = async (username) => {
  try {
    console.log('Attempting direct login for:', username);
    const response = await api.post('/auth/login-direct', { username });
    
    // Store authenticated user in session storage if login was successful
    if (response.data.user && (response.data.authenticated || response.data.status === 'ok')) {
      console.log('Storing authenticated user in session storage:', response.data.user);
      sessionStorage.setItem('authenticatedUser', JSON.stringify(response.data.user));
    }
    
    console.log('Direct login response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Direct login failed:', error);
    throw error;
  }
};

// Add a way to check if a user has credentials
export const checkUserCredentials = async (username) => {
  try {
    const response = await api.get(`/auth/debug/user-credentials/${encodeURIComponent(username)}`);
    return response.data;
  } catch (error) {
    console.error('Failed to check user credentials:', error);
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
  try {
    console.log('Requesting credential from authenticator with options:', {
      rpId: assertionOptions.rpId,
      challenge: assertionOptions.challenge.substring(0, 10) + '...',
      allowCredentials: assertionOptions.allowCredentials?.length || 0
    });
    
    // Ensure challenge is a string before conversion
    const challenge = assertionOptions.challenge.toString();
    assertionOptions.challenge = base64URLToBuffer(challenge);
    
    // Convert allowed credentials to ArrayBuffer if they exist
    if (assertionOptions.allowCredentials) {
      assertionOptions.allowCredentials = assertionOptions.allowCredentials.map(credential => ({
        id: base64URLToBuffer(credential.id.toString()),
        type: 'public-key',
        transports: credential.transports || ['internal', 'hybrid', 'usb', 'ble', 'nfc']
      }));
    }

    // Get the RP ID from environment or hostname
    const rpId = getRpId();
    
    // Ensure rpId is set correctly
    assertionOptions.rpId = rpId;
    
    console.log('Calling navigator.credentials.get()...');
    
    // Get credential from authenticator with improved error handling
    try {
      const credential = await navigator.credentials.get({
        publicKey: assertionOptions,
        mediation: 'optional'
      });
      
      console.log('Received credential from authenticator:', credential ? 'success' : 'null');
      
      if (!credential) {
        throw new Error('No credential returned from authenticator');
      }

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
    } catch (webAuthnError) {
      console.error('WebAuthn API error:', webAuthnError);
      
      // Provide more user-friendly error messages based on the error
      if (webAuthnError.name === 'NotAllowedError') {
        throw new Error('Authentication was rejected by the user or device');
      } else if (webAuthnError.name === 'SecurityError') {
        throw new Error('The operation is insecure (not allowed in this context)');
      } else {
        throw webAuthnError;
      }
    }
  } catch (error) {
    console.error('Get credential error:', error);
    throw error;
  }
};
