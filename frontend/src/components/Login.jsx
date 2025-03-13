import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoginOptions, sendLoginResponse, getCredential, loginDirect } from '../services/authService';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [verifiedUsername, setVerifiedUsername] = useState(null);

  // Regular WebAuthn login - used as second step after direct verification
  async function handleWebAuthnAuthentication(username) {
    try {
      setMessage('Starting WebAuthn authentication...');

      // Get assertion options from server
      const assertionOptions = await getLoginOptions(username);
      
      // Get credential from authenticator
      const assertionResponse = await getCredential(assertionOptions);

      // Send assertion to server
      const verificationRes = await sendLoginResponse(assertionResponse);

      if (verificationRes.status === 'ok') {
        setMessage('Login successful!');
        login(verificationRes.user); // Use context login function
        navigate('/dashboard');
      } else {
        throw new Error(verificationRes.message || 'Login failed');
      }
    } catch (error) {
      console.error('WebAuthn authentication error:', error);
      setMessage(`Authentication failed: ${error.message}`);
      setIsLoggingIn(false);
    }
  }

  // Direct login now just verifies user exists and has credentials,
  // then triggers the WebAuthn authentication
  async function handleDirectLogin(username) {
    if (!username) {
      setMessage('Please enter your username first');
      return;
    }
  
    setMessage('Verifying user account...');
    setIsLoggingIn(true);
    
    try {
      // First stage: Just verify the user exists
      const response = await loginDirect(username);
      
      if (response.status === 'ok' && response.userExists) {
        // Store the verified username for the next step
        setVerifiedUsername(username);
        setMessage('User verified. Please authenticate with your security key or biometrics...');
        
        // Move to second stage: Require WebAuthn authentication
        await handleWebAuthnAuthentication(username);
      } else {
        setMessage('Account verification failed: ' + (response.message || 'User not found'));
        setIsLoggingIn(false);
      }
    } catch (error) {
      setMessage('Account verification failed: ' + (error.message || 'Unknown error'));
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="max-w-md mx-auto dark:bg-gray-800 rounded-lg shadow-lg p-8 m-4">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Login</h2>
      
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoggingIn}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
        
        <button 
          onClick={() => handleDirectLogin(username)}
          disabled={isLoggingIn}
          className="w-full bg-blue-500 hover:bg-blue-600 !important text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {isLoggingIn ? 'Authenticating...' : 'Login with WebAuthn'}
        </button>
      </div>
      
      {message && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          message.includes('failed') || message.includes('error') 
            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
            : message.includes('successful') 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        }`}>
          {message}
        </div>
      )}
      
      <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
        <a href="/register" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          Need to register?
        </a>
      </p>
    </div>
  );
};

export default Login;
