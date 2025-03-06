import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRegistrationOptions, sendRegistrationResponse, createCredential } from '../services/authService';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');

  async function handleRegister() {
    try {
        if (!username || !displayName) {
            setMessage('Please fill in all fields');
            return;
        }

        setMessage('Starting registration...');
        
        // Get registration options from server
        const credentialOptions = await getRegistrationOptions(username, displayName);
        
        // Create credentials 
        const credentialResponse = await createCredential(credentialOptions);

        // Send credential to server
        const finalizeRes = await sendRegistrationResponse(credentialResponse);

        console.log('Server response:', finalizeRes); // Log the full response for debugging

        if (finalizeRes.error) {
            throw new Error(finalizeRes.error);
        }

        if (finalizeRes.status === 'ok') {
            setMessage('Registration successful!');
            
            // Create user object if not directly provided in the response
            const userData = finalizeRes.user || {
                username: username,
                displayName: displayName,
                // Add any other fields that might come from the server
                id: finalizeRes.id || finalizeRes.userId || username
            };
            
            console.log('User data being passed to context:', userData);
            
            // Pass user data to the context
            register(userData);
            navigate('/dashboard');
        } else {
            throw new Error('Registration failed: The operation either timed out');
        }
    } catch (error) {
        console.error('Registration error details:', {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack,
            response: error.response?.data
        });

        let errorMessage = 'Registration failed: ';
        if (error.response?.data?.error) {
            errorMessage += error.response.data.error;
        } else if (error.response?.data?.message) {
            errorMessage += error.response.data.message;
        } else if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += 'Unknown error occurred';
        }

        setMessage(errorMessage);
    }
  }

  return (
    <div>
      <h2>Register</h2>
      <input placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
      <input placeholder="Display Name" onChange={(e) => setDisplayName(e.target.value)} />
      <button onClick={handleRegister}>Register</button>
      <p>{message}</p>
      <p>
        <a href="/login">Already registered? Login here</a>
      </p>
    </div>
  );
};

export default Register;
