import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoginOptions, sendLoginResponse, getCredential, loginDirect, checkUserCredentials } from '../services/authService';
import api from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, currentUser } = useAuth();
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Check if user is already logged in and redirect if needed
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      console.log('User already authenticated, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, currentUser, navigate]);

  // Handle redirect countdown
  useEffect(() => {
    if (redirectCountdown !== null) {
      if (redirectCountdown <= 0) {
        console.log('Redirect countdown finished, navigating to dashboard');
        window.location.href = '/dashboard';
      } else {
        const timer = setTimeout(() => {
          setRedirectCountdown(redirectCountdown - 1);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [redirectCountdown, navigate]);

  // Add this effect to check for forced redirect flag
  useEffect(() => {
    const forceRedirect = sessionStorage.getItem('force_auth_redirect');
    if (forceRedirect) {
      console.log('Found forced redirect flag:', forceRedirect);
      sessionStorage.removeItem('force_auth_redirect');
      navigate(forceRedirect, { replace: true });
    }
  }, [navigate]);

  // Fixed WebAuthn authentication function
  async function handleWebAuthnAuthentication(username) {
    try {
      setMessage('Starting WebAuthn authentication...');
      
      // Store username in localStorage for backup
      localStorage.setItem('temp_username', username);
      
      // Get assertion options from server
      const assertionOptions = await getLoginOptions(username);
      
      // Get credential from authenticator
      setMessage('Please follow the instructions on your authenticator device...');
      const assertionResponse = await getCredential(assertionOptions);
      
      setMessage('Verifying your passkey...');
      
      // Add backup challenge to the response
      if (localStorage.getItem('login_challenge_backup')) {
        assertionResponse._challengeBackup = localStorage.getItem('login_challenge_backup');
      }
      
      // Send assertion to server
      const verificationRes = await sendLoginResponse(assertionResponse);
      
      if (verificationRes.status === 'ok') {
        console.log('Authentication successful!', verificationRes);
        
        // Ensure we have a valid user object
        const userData = {
          id: verificationRes.user?.id || Date.now(),
          username: verificationRes.user?.username || username,
          displayName: verificationRes.user?.displayName || username
        };
        
        // CRITICAL FIX: Store auth in sessionStorage FIRST
        sessionStorage.setItem('authenticatedUser', JSON.stringify(userData));
        localStorage.setItem('authenticated', 'true');
        
        // Set context state (might not finish before redirect)
        login(userData);
        
        // Visual indicator of success
        setMessage('Login successful! Redirecting to dashboard...');
        setAuthSuccess(true);
        
        // CRITICAL FIX: Use direct URL change with forced reload
        setTimeout(() => {
          window.location.href = `/dashboard?auth=1&t=${Date.now()}`;
        }, 300);
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
    setAuthSuccess(false);
    setRedirectCountdown(null);
    
    try {
      // Try to do WebAuthn authentication directly
      await handleWebAuthnAuthentication(username);
    } catch (error) {
      console.error('WebAuthn authentication error:', error);
      setMessage(`Authentication failed: ${error.message}`);
      setIsLoggingIn(false);
    }
  }
  
  // Manual redirect function if automatic redirect fails
  function handleManualRedirect() {
    window.location.href = '/dashboard';
  }

  return (
    <div className="max-w-md mx-auto dark:bg-gray-800 rounded-lg shadow-lg p-8 m-4">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Login</h2>
      
      {!authSuccess ? (
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
      ) : (
        <div className="mt-6 text-center">
          <div className="animate-pulse mb-4">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">Authentication Successful!</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Redirecting to Dashboard in {redirectCountdown} {redirectCountdown === 1 ? 'second' : 'seconds'}...
          </p>
          <button
            onClick={handleManualRedirect}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-200"
          >
            Continue to Dashboard
          </button>
        </div>
      )}
      
      {message && !authSuccess && (
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
      
      {!authSuccess && (
        <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
          <a href="/register" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
            Need to register?
          </a>
        </p>
      )}
    </div>
  );
};

export default Login;
