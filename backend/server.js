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

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-development-only',
    resave: false,
    saveUninitialized: true,
    name: 'fido2session',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        path: '/'
    }
}));

// Session tracking middleware
app.use((req, res, next) => {
    // Generate a session ID for tracking if needed
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

// Sync models and start server
sequelize.sync().then(() => {
  const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || 3001;
  app.listen(BACKEND_PORT, () => {
    console.log(`Server running on port ${BACKEND_PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});
