import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
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
      const optionsRes = await axios.post('http://localhost:3001/auth/login', 
        { username },
        { withCredentials: true }
      );

      let assertionOptions = optionsRes.data;

      // Hide due to security measures
      // console.log('Received assertion options:', assertionOptions);

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

      // Get credential from authenticator
      const credential = await navigator.credentials.get({
        publicKey: assertionOptions
      });

      
      // Hide due to security measures
      // console.log('Credential received:', credential);

      // Format credential for transmission
      const assertionResponse = {
        id: arrayBufferToBase64URL(credential.rawId),
        rawId: arrayBufferToBase64URL(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: arrayBufferToBase64URL(credential.response.authenticatorData),
          clientDataJSON: arrayBufferToBase64URL(credential.response.clientDataJSON),
          signature: arrayBufferToBase64URL(credential.response.signature),
          // Remove userHandle as it's not needed for assertion
        }
      };

      
      // Hide due to security measures
      // console.log('Sending assertion response:', assertionResponse);

      // Send assertion to server
      const verificationRes = await axios({
        method: 'POST',
        url: 'http://localhost:3001/auth/login/response',
        data: assertionResponse,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: true
      });

      if (verificationRes.data.status === 'ok') {
        setMessage('Login successful!');
        onAuthSuccess(verificationRes.data.user); // Pass user data to parent
        navigate('/dashboard');
      } else {
        throw new Error(verificationRes.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage(`Login failed: ${error.message}`);
    }
  }

  // Updated helper functions with better error handling
  function arrayBufferToBase64URL(buffer) {
    if (!buffer) {
      console.error('Buffer is null or undefined');
      return null;
    }
    try {
      const bytes = new Uint8Array(buffer);
      const base64 = btoa(String.fromCharCode.apply(null, bytes));
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (error) {
      console.error('Error converting ArrayBuffer to base64URL:', error);
      throw error;
    }
  }

  function base64URLToBuffer(base64URL) {
    if (!base64URL || typeof base64URL !== 'string') {
      console.error('Invalid base64URL:', base64URL);
      return new ArrayBuffer(0);
    }
    try {
      const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const binary = atob(paddedBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error('Error converting base64URL to buffer:', error);
      throw error;
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
