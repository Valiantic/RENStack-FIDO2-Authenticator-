import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoginOptions, sendLoginResponse, getCredential, loginDirect, checkUserCredentials } from '../services/authService';
import api from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // WebAuthn authentication - primary login method
  async function handleWebAuthnAuthentication(username) {
    try {
      setMessage('Starting WebAuthn authentication...');
      
      // Get assertion options from server
      const assertionOptions = await getLoginOptions(username);
      
      // Get credential from authenticator
      setMessage('Please follow the instructions on your authenticator device...');
      const assertionResponse = await getCredential(assertionOptions);
      
      setMessage('Verifying your passkey...');
      // Send assertion to server
      const verificationRes = await sendLoginResponse(assertionResponse);
      
      if (verificationRes.status === 'ok') {
        setMessage('Login successful! Redirecting to dashboard...');
        console.log('Login successful, user data:', verificationRes.user);
        
        // Save authentication info
        login(verificationRes.user);
        
        // Clear local form state
        setUsername('');
        
        // Force navigation with hard redirect if setTimeout doesn't work
        console.log('Navigating to dashboard...');
        try {
          // First try normal navigation
          navigate('/dashboard', { replace: true });
          
          // As backup, set a timeout to force redirect
          setTimeout(() => {
            console.log('Timeout redirect to dashboard');
            window.location.href = '/dashboard';
          }, 1000);
        } catch (navError) {
          console.error('Navigation error:', navError);
          // Fall back to window.location as last resort
          window.location.href = '/dashboard';
        }
      } else {
        throw new Error(verificationRes.message || 'Login failed');
      }
    } catch (error) {
      // Error handling for specific cases
      if (error.message?.includes('User not found')) {
        throw new Error(`User "${username}" not found. Please register first.`);
      } else if (error.message?.includes('No credentials registered')) {
        throw new Error(`No passkeys found for "${username}". Please re-register.`);
      } else {
        throw error;
      }
    }
  }

  // Main login handler - uses WebAuthn by default
  async function handleLogin(username) {
    if (!username) {
      setMessage('Please enter your username first');
      return;
    }
  
    setIsLoggingIn(true);
    
    try {
      // Try to do WebAuthn authentication directly
      await handleWebAuthnAuthentication(username);
    } catch (error) {
      console.error('WebAuthn authentication error:', error);
      setMessage(`Authentication failed: ${error.message}`);
      
      // If we get here, WebAuthn failed - offer fallback to direct login
      if (error.message?.includes('User not found')) {
        setMessage(`User "${username}" not found. Please register first.`);
      } else if (error.message?.includes('No credentials')) {
        setMessage(`No passkeys found for "${username}". Please register first.`);
      } else {
        setMessage(`Authentication failed: ${error.message}`);
      }
      
      setIsLoggingIn(false);
    }
  }
  
  // Fallback direct login without WebAuthn - only used as backup
  async function handleFallbackLogin(username) {
    if (!username) {
      setMessage('Please enter your username first');
      return;
    }
    
    setMessage('Attempting direct login (no passkey verification)...');
    setIsLoggingIn(true);
    
    try {
      const directLoginResponse = await loginDirect(username);
      
      if (directLoginResponse.status === 'ok') {
        setMessage('Login successful! Redirecting...');
        
        // Set the authenticated user in context
        login(directLoginResponse.user);
        
        // Force navigation with both approaches
        console.log('Direct login successful, navigating to dashboard...');
        navigate('/dashboard', { replace: true });
        
        // Backup redirect method
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      } else {
        throw new Error(directLoginResponse.message || 'Login failed');
      }
    } catch (error) {
      console.error('Direct login error:', error);
      setMessage(`Login failed: ${error.message}`);
    } finally {
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
          onClick={() => handleLogin(username)}
          disabled={isLoggingIn}
          className="w-full bg-blue-500 hover:bg-blue-600 !important text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {isLoggingIn ? 'Authenticating...' : 'Login with Passkey'}
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
      
      {/* Add fallback option if WebAuthn fails */}
      {message && message.includes('failed') && (
        <div className="mt-4 text-center">
          <button
            onClick={() => handleFallbackLogin(username)}
            className="text-sm text-gray-600 hover:underline"
            disabled={isLoggingIn}
          >
            Try alternative login method
          </button>
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
