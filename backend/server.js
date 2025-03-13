require('dotenv').config(); // Load env variables early
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const sequelize = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();

// Helper function to get clean origin
const getCleanOrigin = () => {
  // Use FRONTEND_PORT from environment if available
  const frontendPort = process.env.FRONTEND_PORT;
  const frontendHost = process.env.FRONTEND_HOST;
  const protocol = process.env.FRONTEND_PROTOCOL;
  
  // Use full ORIGIN if provided, otherwise construct from components
  const origin = process.env.ORIGIN || `${protocol}://${frontendHost}:${frontendPort}`;
  
  // Remove trailing slash if present
  return origin.replace(/\/$/, '');
};

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Get origins for CORS configuration
const allowedOrigins = [
  getCleanOrigin(),
  'https://renstack-fido2-authenticator.onrender.com',
  process.env.ADDITIONAL_ORIGIN,
].filter(Boolean); // Filter out any undefined/null/empty values

// Configure CORS before other middleware
app.use(cors({
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Session-ID'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 600 // Reduce preflight requests
}));

// Log the CORS and RP settings on startup
console.log('======= WebAuthn Configuration =======');
console.log(`Origins: ${allowedOrigins.join(', ')}`);
console.log(`RP ID: ${process.env.RP_ID}`);
console.log(`RP Name: ${process.env.RP_NAME}`);
console.log('====================================');

// Helmet configuration
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// Enhanced session configuration for cross-domain support with longer expiration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-development-only',
    resave: false,
    saveUninitialized: false,
    name: 'fido2session',
    cookie: {
        // CRITICAL FIX: Increase session timeout to 7 days
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days instead of 1 day
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true,
        path: '/'
    }
};

// Important: Add this before using session middleware
// Memory store is not suitable for production - warning and fallback
if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: Using default memory store for sessions. This is not suitable for production.');
    console.warn('Consider using a persistent session store like connect-redis or connect-mongo');
}

// Add domain to cookie in production
if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
    sessionConfig.cookie.domain = process.env.COOKIE_DOMAIN;
}

// Use session middleware with enhanced config
app.use(session(sessionConfig));

// Enhanced session save mechanism to ensure reliability
app.use((req, res, next) => {
    const originalEnd = res.end;
    const originalJson = res.json;
    
    // Override res.end to ensure session is saved before responding
    res.end = function() {
        if (req.session && req.session.save) {
            try {
                req.session.save(err => {
                    if (err) {
                        console.error('Session save error in res.end:', err);
                    }
                    originalEnd.apply(res, arguments);
                });
            } catch (e) {
                console.error('Exception in session save:', e);
                originalEnd.apply(res, arguments);
            }
        } else {
            originalEnd.apply(res, arguments);
        }
    };
    
    // Also override res.json for better session handling
    res.json = function(data) {
        if (req.session && req.session.save) {
            try {
                req.session.save(err => {
                    if (err) {
                        console.error('Session save error in res.json:', err);
                    }
                    originalJson.call(this, data);
                });
            } catch (e) {
                console.error('Exception in session save (json):', e);
                originalJson.call(this, data);
            }
        } else {
            originalJson.call(this, data);
        }
    };
    
    next();
});

// Add explicit session save middleware
app.use((req, res, next) => {
    const oldEnd = res.end;
    
    // Override res.end to ensure session is saved before responding
    res.end = function() {
        if (req.session && req.session.save) {
            req.session.save(err => {
                if (err) {
                    console.error('Session save error:', err);
                }
                oldEnd.apply(res, arguments);
            });
        } else {
            oldEnd.apply(res, arguments);
        }
    };
    
    next();
});

// Session tracking middleware
app.use((req, res, next) => {
    // Generate a session ID for tracking if needed
    if (!req.session) {
        console.error('Session middleware not initialized properly');
        return next(new Error('Session middleware failure'));
    }
    
    if (!req.session.initialized) {
        req.session.initialized = true;
        req.session.createdAt = new Date().toISOString();
        console.log(`Initialized new session: ${req.sessionID}`);
    }
    
    // Track custom session ID from header if present
    const customSessionId = req.headers['x-session-id'];
    if (customSessionId) {
        req.session.customSessionId = customSessionId;
        console.log(`Using custom session ID: ${customSessionId}`);
    }
    
    next();
});

// Enhanced logging middleware
app.use((req, res, next) => {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body) {
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.password) sanitizedBody.password = '[FILTERED]';
        console.log('Body:', JSON.stringify(sanitizedBody, null, 2));
    }
    console.log('Session ID:', req.sessionID);
    next();
});

// Add OPTIONS handling
app.options('*', cors());

// Add explicit verification for route mounting
console.log('=== Mounting Routes ===');

// Add debug middleware specifically for registration endpoints
app.use('/auth/register*', (req, res, next) => {
  console.log('\n==== REGISTRATION REQUEST DETAILS ====');
  console.log(`Path: ${req.path}`);
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Session ID:', req.sessionID);
  console.log('Has session?', !!req.session);
  console.log('Has challenge?', !!req.session?.challenge);
  console.log('=============================');
  next();
});

// Mount routes
app.use('/auth', authRoutes);
console.log('Auth routes mounted at /auth');

// Additional route to verify the auth router is properly mounted
app.get('/check-auth-routes', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auth routes are properly mounted',
    routes: {
      register: '/auth/register',
      registerResponse: '/auth/register/response',
      login: '/auth/login',
      loginResponse: '/auth/login/response',
      logout: '/auth/logout'
    }
  });
});

// Add a simple redirect for login GET requests to help users
app.get('/auth/login', (req, res) => {
  res.status(405).json({
    error: 'Method not allowed',
    message: 'Please use POST request for login',
    note: 'If you are trying to access the login page, please go to the frontend application'
  });
});

// Add diagnostic routes for database connection
app.get('/db-status', async (req, res) => {
  try {
    await sequelize.authenticate();
    const dbConfig = {
      dialect: sequelize.options.dialect,
      host: sequelize.options.host,
      port: sequelize.options.port,
      database: sequelize.options.database,
      username: sequelize.options.username,
      logging: !!sequelize.options.logging,
      connected: true
    };
    res.json({ status: 'ok', message: 'Database connection successful', config: dbConfig });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed', 
      error: error.message 
    });
  }
});

// Add a user diagnostic endpoint to check credentials
app.get('/check-user', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ error: 'Username parameter is required' });
    }
    
    const user = await User.findOne({ where: { username } });
    
    if (!user) {
      return res.json({
        exists: false,
        message: 'User not found'
      });
    }
    
    const credentials = await Credential.findAll({ where: { userId: user.id } });
    
    res.json({
      exists: true,
      username: user.username,
      displayName: user.displayName,
      credentialCount: credentials.length,
      credentials: credentials.map(c => ({
        id: c.id, 
        credentialId: c.credentialId.substring(0,10) + '...',
        created: c.createdAt
      }))
    });
  } catch (err) {
    console.error('User check error:', err);
    res.status(500).json({ error: 'Failed to check user', message: err.message });
  }
});

// Basic test route
app.get('/', (req, res) => {
    res.send('FIDO2 Authenticator Server is running.');
});

// Session test route
app.get('/session-check', (req, res) => {
    res.json({ 
        sessionId: req.sessionID, 
        session: req.session 
    });
});

// Updated error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Something went wrong!',
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Add a route to check if other routes exist
app.get('/check-route/:path(*)', (req, res) => {
  const routePath = '/' + req.params.path;
  
  // Check if route exists in Express router
  const routeExists = app._router.stack.some(r => {
    if (r.route && r.route.path) {
      return r.route.path === routePath;
    }
    return false;
  });
  
  res.json({
    path: routePath,
    exists: routeExists,
    message: routeExists ? 'Route exists' : 'Route does not exist'
  });
});

// This should be the LAST route defined
app.get('*', (req, res, next) => {
    // Skip API routes and known endpoints
    if (req.url.startsWith('/auth/') || 
        req.url.startsWith('/api/') || 
        req.url === '/session-check' ||
        req.url === '/db-status' ||
        req.url.startsWith('/check-route/')) {
        return next();
    }
    
    console.log('Catch-all route for SPA routing:', req.url);
    res.json({
        status: 'error',
        message: 'This is a REST API server. Frontend routes should be handled by your client application.',
        requestedPath: req.url
    });
});

// Sync models and start server
sequelize.sync().then(() => {
  const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || 3001;
  app.listen(BACKEND_PORT, () => {
    console.log(`Server running on port ${BACKEND_PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});
