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
  // Remove trailing slash if present
  const origin = process.env.ORIGIN || 'http://localhost:5173';
  return origin.replace(/\/$/, '');
};

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS before other middleware
app.use(cors({
    origin: getCleanOrigin(), // Use clean origin value
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    maxAge: 600 // Reduce preflight requests
}));

// Log the CORS and RP settings on startup
console.log('======= WebAuthn Configuration =======');
console.log(`Origin: ${getCleanOrigin()}`);
console.log(`RP ID: ${process.env.RP_ID || 'localhost'}`);
console.log(`RP Name: ${process.env.RP_NAME || 'FIDO2 Demo'}`);
console.log('====================================');

// Helmet configuration
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    name: 'fido2session',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        path: '/'
    }
}));

// Enhanced logging middleware
app.use((req, res, next) => {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    console.log('Session:', req.session);
    next();
});

// Add request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Add OPTIONS handling
app.options('*', cors());

// Add session debug middleware
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    next();
});

// Mount routes
app.use('/auth', authRoutes);

// Basic test route
app.get('/', (req, res) => {
    res.send('FIDO2 Authenticator Server is running.');
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
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});
