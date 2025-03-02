import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Configure axios defaults
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.post['Content-Type'] = 'application/json';

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
        
        //  Get registration options from server
        const optionsRes = await axios.post('http://localhost:3001/auth/register', 
            { username, displayName },
            { 
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        ).catch(error => {
            console.error('Options request failed:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            });
            throw error;
        });
        
        let credentialOptions = optionsRes.data;

        // Convert challenge and user ID to ArrayBuffer
        credentialOptions.challenge = base64URLToBuffer(credentialOptions.challenge);
        credentialOptions.user.id = base64URLToBuffer(credentialOptions.user.id);
        
        // Create credentials with explicit parameters
        const credential = await navigator.credentials.create({ 
            publicKey: {
                ...credentialOptions,
                rp: {
                    id: 'localhost',
                    name: 'FIDO2 Demo'
                }
            }
        });
        
        // Hide this due to security concerns
        // console.log('Credential created:', credential);

        // Format credential for transmission
        const credentialResponse = {
            id: arrayBufferToBase64URL(credential.rawId),
            rawId: arrayBufferToBase64URL(credential.rawId),
            type: credential.type,
            response: {
                clientDataJSON: arrayBufferToBase64URL(credential.response.clientDataJSON),
                attestationObject: arrayBufferToBase64URL(credential.response.attestationObject)
            }
        };

        
        // Hide this due to security concerns
        // console.log('Sending credential response:', {
        //     id: typeof credentialResponse.id,
        //     rawId: typeof credentialResponse.rawId,
        //     type: credentialResponse.type,
        //     response: {
        //         clientDataJSON: typeof credentialResponse.response.clientDataJSON,
        //         attestationObject: typeof credentialResponse.response.attestationObject
        //     }
        // });

        //  Send credential to server
        const finalizeRes = await axios.post(
            'http://localhost:3001/auth/register/response',
            credentialResponse,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                withCredentials: true
            }
        );

        console.log('Server response:', finalizeRes.data); // Log the full response for debugging

        if (finalizeRes.data.error) {
            throw new Error(finalizeRes.data.error);
        }

        if (finalizeRes.data.status === 'ok') {
            setMessage('Registration successful!');
            
            // Create user object if not directly provided in the response
            const userData = finalizeRes.data.user || {
                username: username,
                displayName: displayName,
                // Add any other fields that might come from the server
                id: finalizeRes.data.id || finalizeRes.data.userId || username
            };
            
            console.log('User data being passed to context:', userData);
            
            // Pass user data to the context
            register(userData);
            navigate('/dashboard');
        } else {
// Display Data Error
            // throw new Error('Registration failed: ' + (finalizeRes.data.message || 'Unknown error'));

            throw new Error('Registration failed: The operation either timed out');
        }
    } catch (error) {
        console.error('Registration error details:', {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack,
            response: {
                data: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            }
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

// Helper functions for ArrayBuffer conversion
function arrayBufferToBase64URL(buffer) {
    const bytes = new Uint8Array(buffer);
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64URLToBuffer(base64URL) {
    const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(paddedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
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
