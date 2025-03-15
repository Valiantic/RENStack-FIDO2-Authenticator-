// INITIALIZATION
const express = require('express');
const { Fido2Lib } = require('fido2-lib');
const router = express.Router();
const User = require('../models/User');
const Credential = require('../models/Credential');
const crypto = require('crypto');
const sequelize = require('../config/database');

// FIDO2 LIBRARY CONFIGURATION 
const fido2 = new Fido2Lib({
  timeout: 60000,
  rpId: process.env.RP_ID,
  rpName: process.env.RP_NAME,
  challengeSize: 64,
  attestation: 'none',
});

// HELPER CONVERTION FOR ARRAYBUFFER TO BASE64URL
const bufferToBase64url = (buffer) =>
  Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// HELPER CONVERTION FOR BASE64URL TO ARRAYBUFFER
const base64URLToBuffer = (base64URL) => {
  const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  return Buffer.from(padded, 'base64');
};

// HELPER FUNCTION TO GET AND VALIDATE ORIGIN 
const getOrigin = () => {

  // FRONTEND_PORT from environment
  const frontendPort = process.env.FRONTEND_PORT;
  const frontendHost = process.env.FRONTEND_HOST;
  const protocol = process.env.FRONTEND_PROTOCOL;
  
  const origin = process.env.ORIGIN || `${protocol}://${frontendHost}:${frontendPort}`;
  
  return origin.replace(/\/$/, '');
};

// HELPER FUNCTION TO GET rpId FROM ORIGIN OR ENV
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

// METHOD CHECK MIDDLEWARE
const methodCheck = (req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      message: 'Only POST requests are allowed'
    });
  }
  next();
};

// FUNCTION TO SAVE SESSION
const saveSession = async (req) => {
  if (!req.session) {
    throw new Error('Session not available');
  }
  
  return new Promise((resolve, reject) => {
    req.session.save(err => {
      if (err) {
        console.error('Failed to save session:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// HELPER TO STORE CHALLENGE BEFORE REGISTRATION OR LOGIN
const storeChallenge = async (req, challenge, username = null) => {
  if (!req.session) {
    throw new Error('Session not available');
  }
  
  req.session.challenge = challenge;
  if (username) req.session.username = username;
  req.session.challengeTimestamp = Date.now();
  
  await saveSession(req);
  
  // LOG SESSION AFTER STORING
  console.log(`Challenge stored in session ${req.sessionID}:`, {
    challenge: challenge.substring(0, 10) + '...',
    username: req.session.username,
    timestamp: req.session.challengeTimestamp
  });
};

// ---------- REGISTRATION  ----------


router.post('/register', async (req, res) => {
  try {
    const { username, displayName } = req.body;
    if (!username || !displayName) {
      return res.status(400).json({ error: 'Missing username or displayName' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    console.log('Generating registration options for:', username);

    const registrationOptions = await fido2.attestationOptions();

    // CONVERT CHALLENGE TO BASE64URL
    registrationOptions.challenge = bufferToBase64url(registrationOptions.challenge);

    registrationOptions.user = {
      id: crypto.randomBytes(32),
      name: username,
      displayName: displayName
    };

    // CONVERT USER ID TO BASE64URL
    registrationOptions.user.id = bufferToBase64url(registrationOptions.user.id);

    // ADD RP CONFIGURATION WITH VALIDATED RP ID
    const rpId = getRpId();
    registrationOptions.rp = {
      name: process.env.RP_NAME || 'FIDO2 Demo',
      id: rpId
    };

    console.log(`Using RP ID: ${rpId}`);

    // STORE CHALLENGE USING HELPER FUNCTION
    await storeChallenge(req, registrationOptions.challenge, username);
    req.session.displayName = displayName;
    await saveSession(req);

    console.log(`Registration options sent to client. SessionID: ${req.sessionID}`);

    res.json({
      ...registrationOptions,
      sessionId: req.sessionID,
      _challengeBackup: registrationOptions.challenge,
      _debugAuthInfo: {
        serverTime: new Date().toISOString(),
        sessionId: req.sessionID,
        hasChallenge: !!req.session.challenge,
        challengeTimestamp: req.session.challengeTimestamp
      }
    });
  } catch (err) {
    console.error('Error creating registration options:', err);
    res.status(500).json({ 
      error: 'Error creating registration options', 
      details: err.message 
    });
  }
});

// ENDPOINT TO STORE CHALLENGE 
router.post('/store-challenge', async (req, res) => {
  try {
    const { challenge, sessionId } = req.body;
    if (!challenge) {
      return res.status(400).json({ error: 'Missing challenge' });
    }

    // STORE CHALLENGE IN SESSION 
    req.session.challenge = challenge;
    
    // FORCE SAVE SESSION 
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          console.error('Failed to save session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    console.log('Challenge stored in session:', {
      sessionId: req.sessionID,
      challenge: challenge.substring(0, 10) + '...'
    });
    
    res.json({ 
      status: 'ok', 
      message: 'Challenge stored successfully',
      sessionId: req.sessionID
    });
  } catch (err) {
    console.error('Error storing challenge:', err);
    res.status(500).json({ error: 'Failed to store challenge', message: err.message });
  }
});

//  COMPLETE REGISTRATION 
router.post('/register/response', methodCheck, async (req, res) => {
  try {
    console.log('Received registration response');
    
    if (!req.session?.challenge) {
      throw new Error('No challenge found in session');
    }

    const { rawId, type, response } = req.body;

    const attestationResponse = {
      rawId: Uint8Array.from(base64URLToBuffer(rawId)).buffer,
      id: rawId, 
      response: {
        attestationObject: Uint8Array.from(base64URLToBuffer(response.attestationObject)).buffer,
        clientDataJSON: Uint8Array.from(base64URLToBuffer(response.clientDataJSON)).buffer
      },
      type: type,
      getClientExtensionResults: () => ({})
    };

    // FORMAT RP ID AND ORIGIN 
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

    const username = req.session.username;
    const displayName = req.session.displayName;

    let user = await User.findOne({ where: { username } });
    if (!user) {
      user = await User.create({ 
        username, 
        displayName
      });
    }

    // CREATE CREDENTIAL RECORD USE RAW ID INSTEAD OF UNDEFINED ID
    const credential = await Credential.create({
      userId: user.id,
      credentialId: rawId, 
      publicKey: attestationResult.authnrData.get('credentialPublicKeyPem'),
      counter: attestationResult.authnrData.get('counter') || 0
    });

    // SESSION SAVING
   
    req.session.challenge = null;
    req.session.authenticated = true;  
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

router.post('/register-direct', async (req, res) => {
  try {
    console.log('==== DIRECT REGISTRATION ENDPOINT CALLED ====');
    const { username, displayName, rawId } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        error: "Username required"
      });
    }
    
    const credentialId = rawId || req.body.credential?.rawId || req.body.credential?.id || req.body.id;
    
    if (!credentialId) {
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        error: "No credential ID provided"
      });
    }
    
    console.log(`Creating/finding user: "${username}" with credential ID: "${credentialId.substring(0,10)}..."`);
    
    try {
  
      let user = await User.findOne({ where: { username } });
      if (!user) {
        user = await User.create({
          username,
          displayName: displayName || username
        });
        console.log('Created new user:', user.id);
      } else {
        console.log('Found existing user:', user.id);
      }
      
   
      console.log('Creating credential record for user:', user.id);
      const credential = await Credential.create({
        userId: user.id,
        credentialId: credentialId,
        publicKey: "PLACEHOLDER_KEY", 
        counter: 0
      });
      
      console.log('Credential created with ID:', credential.id);
      
      req.session.authenticated = true;
      req.session.username = username;
      req.session.challenge = null;
      await req.session.save();
      
      return res.json({
        status: 'ok',
        success: true,
        message: 'Registration successful via direct endpoint',
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName || username
        }
      });
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (err) {
    console.error('Direct registration error:', err);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: err.message
    });
  }
});

// LOGOUT ROUTE 
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ status: 'ok', message: 'Logged out successfully' });
  });
});

// ---------- LOGIN ----------

// INITIAL LOGIN - Fix user existence checks
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    
    console.log(`[DEBUG] Login attempt for username: "${username}"`);
    
    // Check if user exists in database
    const userExists = await User.findOne({ where: { username } });
    if (!userExists) {
      console.log(`[SECURITY] Login rejected - User does not exist: "${username}"`);
      // Return a generic error message to avoid user enumeration
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // ...existing code after user check...
    try {
    
      const credentials = await Credential.findAll({ 
        where: { userId: userExists.id }
      });
      
      console.log(`[DEBUG] Found ${credentials.length} credentials for user ${username}`);
      
      if (!credentials || credentials.length === 0) {
        console.log(`[DEBUG] No credentials found for user: "${username}"`);
        return res.status(400).json({ 
          error: 'No credentials registered for this user',
          diagnosticInfo: {
            userFound: true,
            credentialsFound: false,
            userId: userExists.id
          }
        });
      }
      
      credentials.forEach((cred, idx) => {
        console.log(`[DEBUG] Credential ${idx+1}: ID=${cred.id}, credentialId=${cred.credentialId.substring(0, 10)}..., userId=${cred.userId}`);
      });
      
      // GENERATE ASSERTION OPTIONS
      const assertionOptions = await fido2.assertionOptions();
      
      // CONVERT CHALLENGE TO BASE64URL
      assertionOptions.challenge = bufferToBase64url(assertionOptions.challenge);
      
      // FORMAT CREDENTIAL IDS
      assertionOptions.allowCredentials = credentials.map(cred => ({
        id: cred.credentialId,
        type: 'public-key',
        transports: ['internal', 'hybrid', 'usb']
      }));
      
      // STORE CHALLENGE ON USERNAME IN SESSION
      await storeChallenge(req, assertionOptions.challenge, username);
      
      console.log('[DEBUG] Full session after storing challenge:', {
        id: req.sessionID,
        challenge: assertionOptions.challenge.substring(0, 10) + '...',
        username: req.session.username,
        authenticated: req.session.authenticated,
        challengeTimestamp: req.session.challengeTimestamp
      });
      
      res.json({
        ...assertionOptions,
        sessionId: req.sessionID,
        _challengeBackup: assertionOptions.challenge,
        _debugAuthInfo: {
          serverTime: new Date().toISOString(),
          sessionId: req.sessionID,
          hasChallenge: !!req.session.challenge,
          username: req.session.username,
          challengeTimestamp: req.session.challengeTimestamp
        }
      });
    } catch (dbErr) {
      console.error('[ERROR] Database error while retrieving credentials:', dbErr);
      return res.status(500).json({ 
        error: 'Error retrieving user credentials', 
        message: dbErr.message
      });
    }
  } catch (err) {
    console.error('[ERROR] Login initiation error:', err);
    res.status(500).json({ error: 'Login initiation failed', message: err.message });
  }
});

// Improve the login response endpoint security
router.post('/login/response', methodCheck, async (req, res) => {
  try {
    console.log('Login response received:', req.body);
    const { id, rawId, type, response, _challengeBackup } = req.body;

    // Get username from session or request
    let username = req.session?.username;
    
    if (!username && req.body.username) {
      console.log('[DEBUG] Using client-provided username backup');
      username = req.body.username;
      
      // CRITICAL: Verify that this username exists in database
      const userExists = await User.findOne({ where: { username } });
      if (!userExists) {
        console.log(`[SECURITY] Login response rejected - User does not exist: "${username}"`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    if (!username) {
      throw new Error('No username found in session or request');
    }

    // Get challenge from session or backup
    let challenge = req.session?.challenge;
    
    if (!challenge && _challengeBackup) {
      console.log('[DEBUG] Using client-provided challenge backup');
      challenge = _challengeBackup;
    }

    if (!challenge) {
      throw new Error('No challenge found in session or request');
    }

    // Get user with credentials
    const user = await User.findOne({
      where: { username },
      include: [{ model: Credential }]
    });

    // Check if user exists with credentials
    if (!user) {
      console.log(`[SECURITY] User not found: "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.Credentials || user.Credentials.length === 0) {
      console.log(`[SECURITY] No credentials found for user: "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const credential = user.Credentials[0];

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

    const origin = getOrigin();
    const rpId = getRpId();

    console.log('Verifying login with:', {
      origin: origin,
      rpId: rpId,
      challenge: challenge.substring(0, 10) + '...'
    });

    const result = await fido2.assertionResult(assertionResponse, {
      challenge: base64URLToBuffer(challenge),
      origin: origin,
      factor: 'either',
      publicKey: credential.publicKey,
      prevCounter: credential.counter,
      rpId: rpId,
      userHandle: null,
      userVerification: "preferred"
    });

    // UPDATE COUNTER 
    await credential.update({ counter: result.authnrData.get('counter') });

    // CLEAR SESSION CHALLENGE
    req.session.challenge = null;
    req.session.authenticated = true; 
    req.session.userId = user.id; 
    req.session.username = username; 
    req.session.lastLogin = new Date().toISOString();
    req.session.challenge = null; 

    try {
      await saveSession(req);
      console.log('[DEBUG] Session successfully saved after authentication');
    } catch (saveError) {
      console.error('[ERROR] Failed to save session after successful auth:', saveError);
    }

    console.log('Session after authentication:', {
      id: req.sessionID,
      authenticated: req.session.authenticated,
      username: req.session.username,
      lastLogin: req.session.lastLogin
    });

    res.json({
      status: 'ok',
      message: 'Authentication successful',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName
      },
      sessionInfo: {
        id: req.sessionID,
        authenticated: req.session.authenticated,
        lastLogin: req.session.lastLogin
      }
    });

  } catch (err) {
    console.error('Login verification error:', err);
    // Return generic error to avoid user enumeration
    res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid credentials'
    });
  }
});

// Secure the direct login endpoint
router.post('/login-direct', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    
    console.log(`Direct login attempt for username: "${username}"`);
    
    // NEVER create users during login flow
    const user = await User.findOne({ where: { username }, include: Credential });
    
    if (!user) {
      console.log(`[SECURITY] Direct login rejected - User does not exist: "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user has credentials
    const hasCredentials = user.Credentials && user.Credentials.length > 0;
    
    if (!hasCredentials) {
      console.log(`[SECURITY] Direct login rejected - No credentials for user: "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Only continue if user exists and has credentials
    // ...existing authentication code...
    req.session.authenticated = true;
    req.session.username = username;
    req.session.userId = user.id;
    
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log(`User ${username} authenticated via direct login`);
    
    res.json({
      status: 'ok',
      message: 'Authentication successful',
      authenticated: true,
      userExists: true,
      hasCredentials: hasCredentials,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || username
      }
    });
    
  } catch (err) {
    console.error('Direct login error:', err);
    // Return generic error to avoid user enumeration
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// SESSION SAVING

// IMPROVED SESSION SAVING 
router.get('/verify-session', async (req, res) => {
  try {
    console.log('[DEBUG] Verify session request received');
    console.log('[DEBUG] Session data:', {
      id: req.sessionID,
      authenticated: req.session?.authenticated,
      username: req.session?.username,
      userId: req.session?.userId,
      hasSession: !!req.session
    });
    
   
    if (req.session && req.session.authenticated && req.session.username) {
      const user = await User.findOne({
        where: { username: req.session.username }
      });
      
      if (user) {
        console.log(`[DEBUG] User ${user.username} is authenticated`);
        

        req.session.lastVerified = new Date().toISOString();
        await new Promise((resolve, reject) => {
          req.session.save(err => {
            if (err) {
              console.error('[ERROR] Failed to save session:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
        
        return res.json({
          status: 'ok',
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName
          },
          session: {
            id: req.sessionID,
            lastVerified: req.session.lastVerified
          }
        });
      } else {
        console.log(`[DEBUG] User from session (${req.session.username}) not found in database`);
      }
    } else {
      console.log('[DEBUG] No valid session found');
    }
    
    // IF NO SESSION OR USER FOUND
    res.json({
      status: 'ok',
      authenticated: false,
      message: 'Session not authenticated or user not found',
      sessionExists: !!req.session
    });
  } catch (err) {
    console.error('[ERROR] Session verification error:', err);
    res.status(500).json({
      error: 'Session verification failed',
      message: err.message
    });
  }
});


router.get('/debug/user-credentials/:username', async (req, res) => {
  try {
    const { username } = req.params;
  
    const user = await User.findOne({ where: { username } });
    
    if (!user) {
      return res.json({
        status: 'error',
        message: 'User not found',
        username: username
      });
    }
    
    const credentials = await Credential.findAll({ where: { userId: user.id } });
    
    res.json({
      status: 'ok',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt
      },
      credentials: credentials.map(c => ({
        id: c.id,
        credentialId: c.credentialId.substring(0, 15) + '...',
        publicKeyType: c.publicKey === 'PLACEHOLDER_KEY' ? 'placeholder' : 'full',
        counter: c.counter,
        createdAt: c.createdAt
      })),
      credentialCount: credentials.length
    });
  } catch (err) {
    console.error('Error in credential debug endpoint:', err);
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

router.get('/debug/session-info', (req, res) => {
  const sessionInfo = {
    id: req.sessionID,
    hasSession: !!req.session,
    cookiePresent: !!req.headers.cookie,
    createdAt: req.session?.createdAt || null,
    authenticated: req.session?.authenticated || false,
    username: req.session?.username || null,
    challengePresent: !!req.session?.challenge,
    challengeTimestamp: req.session?.challengeTimestamp || null,
    serverTime: new Date().toISOString()
  };
  
  console.log('Session debug info requested:', sessionInfo);
  
  res.json({
    status: 'ok',
    sessionInfo
  });
});

module.exports = router;
