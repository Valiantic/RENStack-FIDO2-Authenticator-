import api from './api';
import { arrayBufferToBase64URL, base64URLToBuffer } from '../utils/bufferUtils';

// REGISTRATION SERVICE
export const getRegistrationOptions = async (username, displayName) => {
  try {
    localStorage.setItem('temp_username', username);
    localStorage.setItem('temp_displayName', displayName);
    
    const response = await api.post('/auth/register', { username, displayName });
    
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
    
    const payload = {
      ...credentialResponse,  
      credential: credentialResponse  
    };
    
    try {
      const response = await api.post('/auth/register/response', payload);
      console.log('Registration response from server:', response.data);
      return response.data;
    } catch (originalError) {
      console.warn('Original registration endpoint failed, trying simplified endpoint:', originalError.message);
      
      try {
        const simplifiedResponse = await api.post('/auth/register-simple', payload);
        console.log('Simplified registration response from server:', simplifiedResponse.data);
        return simplifiedResponse.data;
      } catch (simplifiedError) {
        console.warn('Simplified endpoint failed, trying direct endpoint:', simplifiedError.message);
        
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
    
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    throw new Error(`Registration failed: ${errorMessage}`);
  }
};


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

// LOGIN SERVICE
export const getLoginOptions = async (username) => {
  try {
    console.log('Requesting login options for username:', username);
    

    localStorage.setItem('temp_username', username);
    
    const response = await api.post('/auth/login', { username });
    
    if (response.data._challengeBackup) {
      localStorage.setItem('login_challenge_backup', response.data._challengeBackup);
    }
    
    if (response.data.sessionId) {
      localStorage.setItem('auth_session_id', response.data.sessionId);
    }
    
    console.log('Received login options:', {
      ...response.data,
      challenge: response.data.challenge ? response.data.challenge.substring(0, 10) + '...' : 'none',
      allowCredentials: response.data.allowCredentials?.map(c => ({id: c.id.substring(0, 10) + '...'}))
    });
    
    if (!response.data.allowCredentials || response.data.allowCredentials.length === 0) {
      throw new Error('No passkeys available for this user');
    }
    
    return response.data;
  } catch (error) {
    console.error('Login options request failed:', error);
    
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    
    throw error;
  }
};

// SEND LOGIN RESPONSE 
export const sendLoginResponse = async (assertionResponse) => {
  try {
    const challengeBackup = localStorage.getItem('login_challenge_backup');
    const usernameBackup = localStorage.getItem('temp_username');
    
    const payload = {
      ...assertionResponse,
      credential: assertionResponse,
      _challengeBackup: challengeBackup,
      username: usernameBackup,
      sessionId: localStorage.getItem('auth_session_id')
    };
    
    console.log('Sending login response to server:', {
      id: payload.id,
      type: payload.type,
      hasResponse: !!payload.response
    });
    
    // Only use the standard login endpoint - remove fallbacks that create users
    console.log('Sending login response to server...');
    const response = await api.post('/auth/login/response', payload);
    console.log('Login successful! Server response:', response.data);
    
    if (response.data.user) {
      sessionStorage.setItem('authenticatedUser', JSON.stringify(response.data.user));
    }
    
    localStorage.removeItem('login_challenge_backup');
    
    return response.data;
  } catch (error) {
    console.error('Login response submission failed:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Don't attempt to use fallback login methods for non-existent users
    // Let the error propagate to the UI
    let errorMessage = 'Login failed: ';
    if (error.response?.data?.error) {
      errorMessage += error.response.data.error;
    } else if (error.response?.data?.message) {
      errorMessage += error.response.data.message;
    } else if (error.message) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Invalid username or credentials';
    }
    
    throw new Error(errorMessage);
  }
};

export const loginDirect = async (username) => {
  try {
    console.log('Attempting direct login for:', username);
    const response = await api.post('/auth/login-direct', { username });
    
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

// CHECK USER CREDENTIAL
export const checkUserCredentials = async (username) => {
  try {
    const response = await api.get(`/auth/debug/user-credentials/${encodeURIComponent(username)}`);
    return response.data;
  } catch (error) {
    console.error('Failed to check user credentials:', error);
    throw error;
  }
};

// LOGOUT SERVICE
export const logoutUser = async () => {
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
};

// VERIFY USER SESSION
export const verifySession = async () => {
  try {
    const response = await api.get('/auth/verify-session');
    return response.data;
  } catch (error) {
    console.error('Session verification failed:', error);
    throw error;
  }
};

// HELPER FUNCTION TO GET THE RIGHT RP ID
const getRpId = () => {
  const envRpId = import.meta.env.VITE_RP_ID;
  
  if (envRpId) {
    return envRpId;
  }
  
  const hostname = window.location.hostname;
  return hostname === 'localhost' ? 'localhost' : hostname;
};

// WEBAUTHN CREDENTIAL HELPERS
export const createCredential = async (credentialOptions) => {
  try {
    // CONVERT CHALLENGE AND USER ID TO ARRAYBUFFER
    credentialOptions.challenge = base64URLToBuffer(credentialOptions.challenge);
    credentialOptions.user.id = base64URLToBuffer(credentialOptions.user.id);
    
    // GET THE RP IF FROM ENVIROMENT OR HOSTNAME 
    const rpId = getRpId();
    
    console.log('Creating credential with options:', JSON.stringify({
      ...credentialOptions,
      challenge: 'ArrayBuffer (converted)',
      user: { ...credentialOptions.user, id: 'ArrayBuffer (converted)' }
    }, null, 2));
    
    // CREATE CREDENTIALS WITH EXPLICIT PAREMETERS
    const credential = await navigator.credentials.create({ 
      publicKey: {
        ...credentialOptions,
        rp: {
          id: rpId,
          name: 'FIDO2 Demo'
        }
      }
    });
    
    // FORMAT CREDENTIALS FOR TRANSMISSION
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
    
    // ENSURE CHALLENGE IS A STRING BEFORE CONVERSION 
    const challenge = assertionOptions.challenge.toString();
    assertionOptions.challenge = base64URLToBuffer(challenge);
    
    if (assertionOptions.allowCredentials) {
      assertionOptions.allowCredentials = assertionOptions.allowCredentials.map(credential => ({
        id: base64URLToBuffer(credential.id.toString()),
        type: 'public-key',
        transports: credential.transports || ['internal', 'hybrid', 'usb', 'ble', 'nfc']
      }));
    }

    const rpId = getRpId();
    
    assertionOptions.rpId = rpId;
    
    console.log('Calling navigator.credentials.get()...');
    
    try {
      const credential = await navigator.credentials.get({
        publicKey: assertionOptions,
        mediation: 'optional'
      });
      
      console.log('Received credential from authenticator:', credential ? 'success' : 'null');
      
      if (!credential) {
        throw new Error('No credential returned from authenticator');
      }

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
