const express = require('express');
const { Fido2Lib } = require('fido2-lib');
const router = express.Router();
const User = require('../models/User');
const Credential = require('../models/Credential');
const crypto = require('crypto');

// Configure fido2-lib using environment variables where needed
const fido2 = new Fido2Lib({
  timeout: 60000,
  rpId: process.env.RP_ID,
  rpName: process.env.RP_NAME,
  challengeSize: 64,
  attestation: 'none',
});

// Helper to convert ArrayBuffer to base64url
const bufferToBase64url = (buffer) =>
  Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// Helper function to convert base64URL to buffer
const base64URLToBuffer = (base64URL) => {
  const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  return Buffer.from(padded, 'base64');
};

// Helper function to get and validate the origin
const getOrigin = () => {
  // Use FRONTEND_PORT from environment if available
  const frontendPort = process.env.FRONTEND_PORT;
  const frontendHost = process.env.FRONTEND_HOST;
  const protocol = process.env.FRONTEND_PROTOCOL;
  
  // Use full ORIGIN if provided, otherwise construct from components
  const origin = process.env.ORIGIN || `${protocol}://${frontendHost}:${frontendPort}`;
  
  // Ensure the origin is properly formatted (no trailing slash)
  return origin.replace(/\/$/, '');
};

// Helper function to get rpId from origin or env
const getRpId = () => {
  if (process.env.RP_ID) return process.env.RP_ID;
  try {
    // Extract hostname from origin as fallback
    const originUrl = new URL(getOrigin());
    return originUrl.hostname;
  } catch (e) {
    console.error('Failed to parse origin URL:', e);
    return 'localhost';
  }
};

// Add method check middleware
const methodCheck = (req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      message: 'Only POST requests are allowed'
    });
  }
  next();
};

// ---------- Registration ----------

//  Initiate Registration: send options (challenge, etc.)
router.post('/register', async (req, res) => {
  try {
    const { username, displayName } = req.body;
    if (!username || !displayName) {
      return res.status(400).json({ error: 'Missing username or displayName' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    console.log('Generating registration options for:', username);

    // Generate registration options
    const registrationOptions = await fido2.attestationOptions();

    // Convert challenge to base64url
    registrationOptions.challenge = bufferToBase64url(registrationOptions.challenge);

    // Customize options with user info
    registrationOptions.user = {
      id: crypto.randomBytes(32),
      name: username,
      displayName: displayName
    };

    // Convert user id to base64url
    registrationOptions.user.id = bufferToBase64url(registrationOptions.user.id);

    // Add rp configuration with validated rpId
    const rpId = getRpId();
    registrationOptions.rp = {
      name: process.env.RP_NAME || 'FIDO2 Demo',
      id: rpId
    };

    console.log(`Using RP ID: ${rpId}`);

    // Store in session
    req.session.challenge = registrationOptions.challenge;
    req.session.username = username;
    req.session.displayName = displayName;

    console.log('Registration options generated:', registrationOptions);
    res.json(registrationOptions);
  } catch (err) {
    console.error('Error creating registration options:', err);
    res.status(500).json({ 
      error: 'Error creating registration options', 
      details: err.message 
    });
  }
});

// Add GET handler for registration response route
router.get('/register/response', (req, res) => {
  console.log('GET request received for /register/response');
  res.status(405).json({ 
    error: 'Method not allowed', 
    message: 'This endpoint only accepts POST requests for WebAuthn attestation responses',
    suggestion: 'If you\'re seeing this error in your application, ensure your frontend is sending a POST request'
  });
});

//  Complete Registration: verify attestation response
router.post('/register/response', methodCheck, async (req, res) => {
  try {
    console.log('Received registration response');
    
    if (!req.session?.challenge) {
      throw new Error('No challenge found in session');
    }

    const { rawId, type, response } = req.body;

    // Create the attestation response with proper ArrayBuffer format
    const attestationResponse = {
      rawId: Uint8Array.from(base64URLToBuffer(rawId)).buffer,
      id: rawId, // Use rawId as the id
      response: {
        attestationObject: Uint8Array.from(base64URLToBuffer(response.attestationObject)).buffer,
        clientDataJSON: Uint8Array.from(base64URLToBuffer(response.clientDataJSON)).buffer
      },
      type: type,
      getClientExtensionResults: () => ({})
    };

    // Get properly formatted origin and rpId
    const origin = getOrigin();
    const rpId = getRpId();

    console.log('Verifying with parameters:', {
      challenge: req.session.challenge,
      origin: origin,
      rpId: rpId
    });

    const attestationResult = await fido2.attestationResult(
      attestationResponse,
      {
        challenge: Uint8Array.from(base64URLToBuffer(req.session.challenge)).buffer,
        origin: origin,
        factor: 'either',
        rpId: rpId
      }
    );

    // Save user and credential
    const username = req.session.username;
    const displayName = req.session.displayName;

    let user = await User.findOne({ where: { username } });
    if (!user) {
      user = await User.create({ 
        username, 
        displayName
      });
    }

    // Create credential record - Fix: use rawId instead of undefined id
    const credential = await Credential.create({
      userId: user.id,
      credentialId: rawId, // Changed from id to rawId
      publicKey: attestationResult.authnrData.get('credentialPublicKeyPem'),
      counter: attestationResult.authnrData.get('counter') || 0
    });


    // SESSION SAVING

    // Clear challenge from session but keep username and mark as authenticated
    req.session.challenge = null;
    req.session.authenticated = true;  // Add this line to set authentication status
    // Keep username in session for persistence
    await req.session.save();

    res.json({ 
      status: 'ok', 
      message: 'Registration successful',
      user: {
        username: user.username,
        displayName: user.displayName
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      error: 'Registration failed',
      message: err.message,
      details: err.stack
    });
  }
});

// Add logout route
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ status: 'ok', message: 'Logged out successfully' });
  });
});

// ---------- Authentication (Login) ----------

// Initiate Login: generate assertion options
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });

    // Fetch user's registered credentials
    const user = await User.findOne({ where: { username }, include: Credential });
    if (!user || !user.Credentials || user.Credentials.length === 0) {
      return res.status(400).json({ error: 'User not found or no credentials registered' });
    }

    // Generate assertion options
    const assertionOptions = await fido2.assertionOptions();

    // Convert challenge to base64url string
    assertionOptions.challenge = bufferToBase64url(assertionOptions.challenge);

    // Format credential IDs
    assertionOptions.allowCredentials = user.Credentials.map(cred => ({
      id: cred.credentialId,
      type: 'public-key',
      transports: ['internal']
    }));

    // Store in session
    req.session.challenge = assertionOptions.challenge;
    req.session.username = username;
    await req.session.save();

    console.log('Sending assertion options:', assertionOptions);
    res.json(assertionOptions);
  } catch (err) {
    console.error('Login initiation error:', err);
    res.status(500).json({ error: 'Login initiation failed', message: err.message });
  }
});

// Add GET handler for login response route
router.get('/login/response', (req, res) => {
  console.log('GET request received for /login/response');
  res.status(405).json({ 
    error: 'Method not allowed', 
    message: 'This endpoint only accepts POST requests for WebAuthn assertion responses',
    suggestion: 'If you\'re seeing this error in your application, ensure your frontend is sending a POST request'
  });
});

//  Complete Login: verify assertion response
router.post('/login/response', methodCheck, async (req, res) => {
  try {
    console.log('Login response received:', req.body);
    const { id, rawId, type, response } = req.body;

    if (!req.session?.challenge) {
      throw new Error('No challenge found in session');
    }

    const username = req.session.username;
    if (!username) {
      throw new Error('No username found in session');
    }

    // Get user and credential
    const user = await User.findOne({
      where: { username },
      include: [{ model: Credential }]
    });

    if (!user || !user.Credentials.length) {
      throw new Error('No credentials found for user');
    }

    const credential = user.Credentials[0];

    // Create assertion response object with proper Buffer conversions
    const assertionResponse = {
      id: rawId,
      rawId: Uint8Array.from(base64URLToBuffer(rawId)).buffer,
      response: {
        authenticatorData: Uint8Array.from(base64URLToBuffer(response.authenticatorData)).buffer,
        clientDataJSON: Uint8Array.from(base64URLToBuffer(response.clientDataJSON)).buffer,
        signature: Uint8Array.from(base64URLToBuffer(response.signature)).buffer
      },
      type: type
    };

    // Get properly formatted origin and rpId
    const origin = getOrigin();
    const rpId = getRpId();

    console.log('Verifying login with:', {
      origin: origin,
      rpId: rpId,
      challenge: req.session.challenge.substring(0, 10) + '...'
    });

    const result = await fido2.assertionResult(assertionResponse, {
      challenge: base64URLToBuffer(req.session.challenge),
      origin: origin,
      factor: 'either',
      publicKey: credential.publicKey,
      prevCounter: credential.counter,
      rpId: rpId,
      userHandle: null,
      userVerification: "preferred"
    });

    // Update counter
    await credential.update({ counter: result.authnrData.get('counter') });

    // Clear session challenge and set authenticated
    req.session.challenge = null;
    req.session.authenticated = true;  // Add this line
    await req.session.save();

    res.json({ 
      status: 'ok', 
      message: 'Authentication successful',
      user: {
        username: user.username,
        displayName: user.displayName
      }
    });

  } catch (err) {
    console.error('Login verification error:', err);
    res.status(500).json({
      error: 'Authentication verification failed',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// SESSION SAVING

// Verify if user session is active
router.get('/verify-session', async (req, res) => {
  try {
    // Check if session exists and is authenticated
    if (req.session && req.session.authenticated && req.session.username) {
      // Get user info from database
      const user = await User.findOne({
        where: { username: req.session.username }
      });
      
      if (user) {
        return res.json({
          status: 'ok',
          authenticated: true,
          user: {
            username: user.username,
            displayName: user.displayName
          }
        });
      }
    }
    
    // If no valid session or user not found
    res.json({
      status: 'ok',
      authenticated: false
    });
  } catch (err) {
    console.error('Session verification error:', err);
    res.status(500).json({
      error: 'Session verification failed',
      message: err.message
    });
  }
});

module.exports = router;
