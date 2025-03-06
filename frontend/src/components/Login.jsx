import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLoginOptions, sendLoginResponse, getCredential } from '../services/authService';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');

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

  return (
    <div>
      <h2>Login</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
      <p>{message}</p>
      <p>
        <a href="/register">Need to register?</a>
      </p>
    </div>
  );
};

export default Login;
