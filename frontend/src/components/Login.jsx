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

  async function handleLogin() {
    try {
      if (!username) {
        setMessage('Please enter your username');
        return;
      }

      setMessage('Starting authentication...');

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
      console.error('Login error:', error);
      setMessage(`Login failed: ${error.message}`);
    }
  }

  async function handleDirectLogin(username) {
    if (!username) {
      setMessage('Please enter your username first');
      return;
    }
  
    setMessage('Attempting simplified login...');
    setIsLoggingIn(true);
    
    try {
      const response = await loginDirect(username);
      if (response.status === 'ok') {
        login(response.user);
        navigate('/dashboard');
      } else {
        setMessage('Login failed: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      setMessage('Login failed: ' + (error.message || 'Unknown error'));
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
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
        
        <button 
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 !important text-white font-bold py-2 px-4 rounded-lg transition duration-200"
        >
          Login with WebAuthn
        </button>

        <div className="mt-4 text-center">
          <button 
            onClick={() => handleDirectLogin(username)}
            className="text-sm text-blue-600 hover:underline"
            disabled={isLoggingIn}
          >
            Having trouble logging in? Try simplified login
          </button>
        </div>
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
