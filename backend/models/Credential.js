const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Credential = sequelize.define('credential', {
  credentialId: {
    type: DataTypes.STRING(512),
    allowNull: false,
  },
  publicKey: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  counter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'Credentials',
});

// DEFINE ASSOCIATIONS OR FOREIGN KEY
User.hasMany(Credential, { foreignKey: 'userId' });
Credential.belongsTo(User, { foreignKey: 'userId' });

module.exports = Credential;
