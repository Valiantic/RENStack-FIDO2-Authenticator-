// INITIALIZED DEPENDECIES

require('dotenv').config(); 
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const sequelize = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();

//  HELPER FUNCTION TO CLEAR ORIGINS 
const getCleanOrigin = () => {
  // USE FRONTEND_PORT FROM ENV
  const frontendPort = process.env.FRONTEND_PORT;
  const frontendHost = process.env.FRONTEND_HOST;
  const protocol = process.env.FRONTEND_PROTOCOL;
  
  // USE ORIGIN 
  const origin = process.env.ORIGIN || `${protocol}://${frontendHost}:${frontendPort}`;
  
  return origin.replace(/\/$/, '');
};

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ALLOWED ORIGINS
const allowedOrigins = [
  getCleanOrigin(),
  'https://renstack-fido2-authenticator.onrender.com',
  process.env.ADDITIONAL_ORIGIN,
].filter(Boolean); 

// CORS CONFIGURATION BEFORE MIDDLEWARE
app.use(cors({
    origin: function(origin, callback) {
     
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
    maxAge: 600 
}));

// LOG CORS CONFIGURATION UPON START 
console.log('======= BackEnd now Running =======');
console.log(`Origins: ${allowedOrigins.join(', ')}`);
console.log(`RP ID: ${process.env.RP_ID}`);
console.log(`RP Name: ${process.env.RP_NAME}`);
console.log('====================================');

// HELMET CONFIGURATION 
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-development-only',
    resave: false,
    saveUninitialized: false,
    name: 'fido2session',
    cookie: {
        // INCREASE SESSION FROM 1 DAY TO 7 DAYS
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true,
        path: '/'
    }
};


if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: Using default memory store for sessions. This is not suitable for production.');
    console.warn('Consider using a persistent session store like connect-redis or connect-mongo');
}

if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
    sessionConfig.cookie.domain = process.env.COOKIE_DOMAIN;
}

// ENABLE SESSION MIDDLEWARE
app.use(session(sessionConfig));

app.use((req, res, next) => {
    const originalEnd = res.end;
    const originalJson = res.json;
    
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

//  SESSION SAVE ON MIDDLEWARE
app.use((req, res, next) => {
    const oldEnd = res.end;
   
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

// SESSION TRACKING MIDDLEWARE 
app.use((req, res, next) => {
    if (!req.session) {
        console.error('Session middleware not initialized properly');
        return next(new Error('Session middleware failure'));
    }
    
    if (!req.session.initialized) {
        req.session.initialized = true;
        req.session.createdAt = new Date().toISOString();
        console.log(`Initialized new session: ${req.sessionID}`);
    }
    
    const customSessionId = req.headers['x-session-id'];
    if (customSessionId) {
        req.session.customSessionId = customSessionId;
        console.log(`Using custom session ID: ${customSessionId}`);
    }
    
    next();
});

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

app.options('*', cors());

console.log('=== Mounting Routes ===');

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

app.use('/auth', authRoutes);
console.log('Auth routes mounted at /auth');

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

app.get('/auth/login', (req, res) => {
  res.status(405).json({
    error: 'Method not allowed',
    message: 'Please use POST request for login',
    note: 'If you are trying to access the login page, please go to the frontend application'
  });
});

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

app.get('/', (req, res) => {
    res.send('FIDO2 Authenticator Server is running.');
});

app.get('/session-check', (req, res) => {
    res.json({ 
        sessionId: req.sessionID, 
        session: req.session 
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Something went wrong!',
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

app.get('/check-route/:path(*)', (req, res) => {
  const routePath = '/' + req.params.path;
  
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

app.get('*', (req, res, next) => {
  
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

sequelize.sync().then(() => {
  const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || 3001;
  app.listen(BACKEND_PORT, () => {
    console.log(`Server running on port ${BACKEND_PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});
