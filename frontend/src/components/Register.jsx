import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRegistrationOptions, sendRegistrationResponse, createCredential, verifyRegistration } from '../services/authService';
import api from '../services/api'; // Import the api instance

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleRegister() {
    try {
        if (!username || !displayName) {
            setMessage('Please fill in all fields');
            return;
        }

        setMessage('Starting registration...');
        setIsRegistering(true);
        
        // Check session before registration options
        console.log('Checking session before registration...');
        const sessionCheckBefore = await api.get('/session-check');
        console.log('Session before registration:', sessionCheckBefore.data);

        // Get registration options from server
        const credentialOptions = await getRegistrationOptions(username, displayName);
        
        // Store the challenge in the session
        console.log('Storing challenge in session...');
        await api.post('/auth/store-challenge', { challenge: credentialOptions.challenge });
        console.log('Challenge stored in session successfully.');
        
        // Log session after storing challenge
        const sessionCheckAfterStoreChallenge = await api.get('/session-check');
        console.log('Session after storing challenge:', sessionCheckAfterStoreChallenge.data);
        
        setMessage('Please follow the instructions on your authenticator...');
        
        // Create credentials 
        const credentialResponse = await createCredential(credentialOptions);

        setMessage('Sending registration data to server...');
        console.log('Credential response to be sent:', credentialResponse);
        
        try {
            // Send credential to server with explicit error handling
            const finalizeRes = await sendRegistrationResponse(credentialResponse);

            // Check session after registration
            console.log('Checking session after registration...');
            const sessionCheckAfter = await api.get('/session-check');
            console.log('Session after registration:', sessionCheckAfter.data);

            console.log('Server response:', finalizeRes); // Log the full response for debugging

            if (finalizeRes.error || finalizeRes.success === false) {
                throw new Error(finalizeRes.error || finalizeRes.message || 'Unknown registration error');
            }

            // Check for success in both old and new response formats
            if (finalizeRes.status === 'ok' || finalizeRes.success === true) {
                setMessage('Registration successful! Redirecting to dashboard...');
                
                // Ensure we have a complete user object with ID
                const userData = {
                  id: finalizeRes.user?.id || Date.now(),
                  username: finalizeRes.user?.username || username,
                  displayName: finalizeRes.user?.displayName || displayName
                };
                
                console.log('Registration successful! User data:', userData);
                
                // Store auth data first, before any navigation attempts
                sessionStorage.setItem('authenticatedUser', JSON.stringify(userData));
                localStorage.setItem('authInProgress', 'true');
                
                // Update context state
                register(userData);
                
                // CRITICAL FIX: Add deliberate delay before navigation
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try React Router navigation first with replace option
                navigate('/dashboard', { replace: true });
                
                // Only use fallback if navigation fails
                setTimeout(() => {
                  if (window.location.pathname !== '/dashboard') {
                    console.log('Fallback: forcing navigation to dashboard');
                    window.location.href = '/dashboard';
                  }
                }, 1000);
            } else {
                throw new Error('Registration failed: The operation either timed out or returned invalid data');
            }
        } catch (responseError) {
            console.error('Error during registration submission:', responseError);
            setMessage(`Registration failed: ${responseError.message}`);
            return; // Exit early on response error
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
    } finally {
        setIsRegistering(false);
    }
  }

  const handleManualRedirect = () => {
    window.location.href = '/dashboard';
  };

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
          disabled={isRegistering}
        />
        
        <input 
          type="text"
          placeholder="Display Name" 
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          disabled={isRegistering}
        />
        
        <button 
          onClick={handleRegister}
          disabled={isRegistering}
          className="w-full bg-blue-500 hover:bg-blue-600 !important text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {isRegistering ? 'Registering...' : 'Register with WebAuthn'}
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
      
      {message && message.includes('successful') && (
        <button 
            id="manual-redirect"
            onClick={handleManualRedirect}
            className="hidden mt-4 mx-auto block bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded"
        >
            Continue to Dashboard
        </button>
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
