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

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      console.log('User already authenticated, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, currentUser, navigate]);

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

  useEffect(() => {
    const forceRedirect = sessionStorage.getItem('force_auth_redirect');
    if (forceRedirect) {
      console.log('Found forced redirect flag:', forceRedirect);
      sessionStorage.removeItem('force_auth_redirect');
      navigate(forceRedirect, { replace: true });
    }
  }, [navigate]);

  async function handleWebAuthnAuthentication(username) {
    try {
      setMessage('Starting WebAuthn authentication...');
      
      localStorage.setItem('temp_username', username);
      
      // First check if user exists
      try {
        const assertionOptions = await getLoginOptions(username);
        
        setMessage('Please follow the instructions on your authenticator device...');
        const assertionResponse = await getCredential(assertionOptions);
        
        setMessage('Verifying your passkey...');
        
        if (localStorage.getItem('login_challenge_backup')) {
          assertionResponse._challengeBackup = localStorage.getItem('login_challenge_backup');
        }
    
        const verificationRes = await sendLoginResponse(assertionResponse);
        
        if (verificationRes.status === 'ok') {
          console.log('Authentication successful!', verificationRes);
          
          const userData = {
            id: verificationRes.user?.id || Date.now(),
            username: verificationRes.user?.username || username,
            displayName: verificationRes.user?.displayName || username
          };
          
          sessionStorage.setItem('authenticatedUser', JSON.stringify(userData));
          localStorage.setItem('authInProgress', 'true');
          
          login(userData);
          
          setAuthSuccess(true);
          setMessage('Login successful! Redirecting to dashboard...');
          
          setTimeout(() => {
            console.log('Login successful, forcing navigation to dashboard');
            window.location.href = '/dashboard'; 
          }, 500);
        } else {
          throw new Error(verificationRes.message || 'Login failed');
        }
      } catch (error) {
        // Check for specific unauthorized or invalid credential errors
        if (error.response?.status === 401 || 
            error.message?.includes('Invalid credentials') ||
            error.message?.includes('User not found')) {
          throw new Error('Invalid username or passkey. Please check your credentials.');
        }
        throw error;
      }
    } catch (error) {
      if (error.message?.includes('User not found')) {
        throw new Error(`User "${username}" not found. Please register first.`);
      } else if (error.message?.includes('No credentials registered')) {
        throw new Error(`No passkeys found for "${username}". Please re-register.`);
      } else {
        throw error;
      }
    }
  }

  async function handleLogin(username) {
    if (!username) {
      setMessage('Please enter your username first');
      return;
    }
  
    setIsLoggingIn(true);
    setAuthSuccess(false);
    setRedirectCountdown(null);
    
    try {
      await handleWebAuthnAuthentication(username);
    } catch (error) {
      console.error('WebAuthn authentication error:', error);
      setMessage(`Authentication failed: ${error.message}`);
      setIsLoggingIn(false);
    }
  }

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
