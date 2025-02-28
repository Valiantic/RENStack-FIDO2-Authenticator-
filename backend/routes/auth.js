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

    // Add rp configuration
    registrationOptions.rp = {
      name: process.env.RP_NAME || 'FIDO2 Demo',
      id: process.env.RP_ID || window.location.hostname
    };

    // Store in session
    req.session.challenge = registrationOptions.challenge;
    req.session.username = username;
    req.session.displayName = displayName;

    console.log('Registration options generated:', registrationOptions);
    res.json(registrationOptions);
  } catch (err) {
    console.error('Error creating registration options:', err);
    res.status(500).json({ error: 'Error creating registration options', details: err.message });
  }
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

    console.log('Verifying with parameters:', {
      challenge: req.session.challenge,
      origin: process.env.ORIGIN || 'http://localhost:5173',
      rpId: process.env.RP_ID || 'localhost'
    });

    const attestationResult = await fido2.attestationResult(
      attestationResponse,
      {
        challenge: Uint8Array.from(base64URLToBuffer(req.session.challenge)).buffer,
        origin: process.env.ORIGIN || 'http://localhost:5173',
        factor: 'either',
        rpId: process.env.RP_ID || 'localhost'
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

    // Clear challenge from session
    req.session.challenge = null;
    await req.session.save();

    res.json({ 
      status: 'ok', 
      message: 'Registration successful'
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
    if (!user || user.Credentials.length === 0) {
      return res.status(400).json({ error: 'User not found or no credentials registered' });
    }

    const credentialIds = user.Credentials.map(cred => cred.credentialId);

    const assertionOptions = await fido2.assertionOptions();
    assertionOptions.allowCredentials = credentialIds.map(id => ({ id, type: 'public-key' }));

    // Store challenge and username in session
    req.session.challenge = assertionOptions.challenge;
    req.session.username = username;

    res.json(assertionOptions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login initiation failed' });
  }
});

//  Complete Login: verify assertion response
router.post('/login/response', async (req, res) => {
  try {
    const assertionResponse = req.body;
    const expectedChallenge = req.session.challenge;
    const username = req.session.username;

    if (!expectedChallenge || !username) {
      return res.status(400).json({ error: 'No challenge found in session' });
    }

    // Fetch the user and corresponding credential
    const user = await User.findOne({ where: { username }, include: Credential });
    if (!user) return res.status(400).json({ error: 'User not found' });

    // For simplicity, we select the first registered credential
    const credential = user.Credentials[0];

    const assertionExpectations = {
      challenge: expectedChallenge,
      origin: process.env.ORIGIN,
      factor: 'either',
      publicKey: credential.publicKey,
      prevCounter: credential.counter,
      userHandle: Buffer.from(username).toString('base64'),
    };

    const assertionResult = await fido2.assertionResult(assertionResponse, assertionExpectations);

    // Update the counter in the database
    credential.counter = assertionResult.authnrData.get('counter');
    await credential.save();

    res.json({ status: 'ok', message: 'Authentication successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Authentication verification failed' });
  }
});

module.exports = router;
