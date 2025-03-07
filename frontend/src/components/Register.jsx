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
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 m-4">
      <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Register</h2>
      
      <div className="space-y-4">
        <input 
          type="text"
          placeholder="Username" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
        
        <input 
          type="text"
          placeholder="Display Name" 
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
        
        <button 
          onClick={handleRegister}
          className="w-full bg-blue-500 hover:bg-blue-600 !important text-white font-bold py-2 px-4 rounded-lg transition duration-200"
        >
          Register with WebAuthn
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
        <a href="/login" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          Already registered? Login here
        </a>
      </p>
    </div>
  );
};

export default Register;
