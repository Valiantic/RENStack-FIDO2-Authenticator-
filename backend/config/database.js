require('dotenv').config();
const { Sequelize } = require('sequelize');

// Get database connection parameters
const dbHost = process.env.DB_HOST;
const dbURL = process.env.DATABASE_URL;

let sequelize;
let connectionInfo = {};

// If DATABASE_URL is provided, use it for connection
if (dbURL) {
  sequelize = new Sequelize(dbURL, {
    dialect: 'postgresql',
    logging: false, // disable logging for production`
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // For self-signed certificates
      }
    }
  });
  connectionInfo = { url: dbURL };
} else {
  // Otherwise, use individual connection parameters
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: dbHost,
      dialect: 'postgresql',
      logging: false, // disable logging for production
    }
  );
  connectionInfo = { host: dbHost };
}

// Log connection information (only during initialization)
console.log(`Database connection established with: ${JSON.stringify(connectionInfo)}`);

// Add connection info to the exported object
sequelize.connectionInfo = connectionInfo;

module.exports = sequelize;
