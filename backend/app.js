require('dotenv').config(); // Load env variables early
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const sequelize = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();

// Use Helmet to set secure HTTP headers
app.use(helmet());

// Enable CORS (adjust origin as needed)
app.use(cors({
  origin: process.env.ORIGIN,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Session middleware (store challenge per user session)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }, // set to true if using HTTPS
}));

// Mount authentication routes
app.use('/auth', authRoutes);

// Basic test route
app.get('/', (req, res) => {
  res.send('FIDO2 Authenticator Server is running.');
});

// Sync models and start server
sequelize.sync().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`Server listening on port ${process.env.PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});
