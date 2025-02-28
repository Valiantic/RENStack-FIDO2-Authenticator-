const express = require('express');
const { Fido2Lib } = require('fido2-lib');
const router = express.Router();
const User = require('../models/User');
const Credential = require('../models/Credential');

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

// ---------- Registration ----------

// Step 1: Initiate Registration: send options (challenge, etc.)
router.post('/register', async (req, res) => {
  try {
    const { username, displayName } = req.body;
    if (!username || !displayName) {
      return res.status(400).json({ error: 'Missing username or displayName' });
    }

    // Generate registration options
    const registrationOptions = await fido2.attestationOptions();

    // Customize options with user info
    registrationOptions.user = {
      id: Buffer.from(username).toString('base64'),
      name: username,
      displayName,
    };

    // Store challenge and user info in session
    req.session.challenge = registrationOptions.challenge;
    req.session.username = username;
    req.session.displayName = displayName;

    res.json(registrationOptions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration initiation failed' });
  }
});

// Step 2: Complete Registration: verify attestation response
router.post('/register/response', async (req, res) => {
  try {
    const attestationResponse = req.body;
    const expectedChallenge = req.session.challenge;
    const username = req.session.username;
    const displayName = req.session.displayName;

    if (!expectedChallenge || !username) {
      return res.status(400).json({ error: 'No challenge found in session' });
    }

    const attestationExpectations = {
      challenge: expectedChallenge,
      origin: process.env.ORIGIN,
      factor: 'either',
    };

    const attestationResult = await fido2.attestationResult(attestationResponse, attestationExpectations);

    // Save user and credential info in the database
    let user = await User.findOne({ where: { username } });
    if (!user) {
      user = await User.create({ username, displayName });
    }
    await Credential.create({
      userId: user.id,
      credentialId: bufferToBase64url(attestationResult.authnrData.get('credId')),
      publicKey: attestationResult.authnrData.get('credentialPublicKeyPem'),
      counter: attestationResult.authnrData.get('counter'),
    });

    res.json({ status: 'ok', message: 'Registration successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration verification failed' });
  }
});

// ---------- Authentication (Login) ----------

// Step 1: Initiate Login: generate assertion options
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

// Step 2: Complete Login: verify assertion response
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
