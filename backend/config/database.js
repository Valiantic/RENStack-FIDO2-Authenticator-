require('dotenv').config();
const { Sequelize } = require('sequelize');
 
let sequelize;
let connectionInfo = {};

// If DATABASE_URL is provided, use it for connection
if (dbURL) {
  sequelize = new Sequelize(dbURL, {
    dialect: 'postgresql',
    logging: false, 
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false 
      }
    }
  });
  connectionInfo = { url: dbURL };
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: dbHost,
      dialect: 'postgresql',
      logging: false,
    }
  );
  connectionInfo = { host: dbHost };
}


console.log(`Database connection established with: ${JSON.stringify(connectionInfo)}`);

sequelize.connectionInfo = connectionInfo;

module.exports = sequelize;
