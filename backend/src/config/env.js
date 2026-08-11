const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  appName: process.env.APP_NAME || 'OPERA Config Manager',
  jwtSecret: process.env.JWT_SECRET,
  jwtAccessTokenMinutes: Number(process.env.JWT_ACCESS_TOKEN_MINUTES || 15),
  jwtRefreshTokenDays: Number(process.env.JWT_REFRESH_TOKEN_DAYS || 7),
  db: {
    user: process.env.DB_USER || 'OPERA_CFG_APP',
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    walletDir: process.env.DB_WALLET_DIR,
    poolMin: Number(process.env.DB_POOL_MIN || 1),
    poolMax: Number(process.env.DB_POOL_MAX || 5),
    poolIncrement: Number(process.env.DB_POOL_INCREMENT || 1)
  },
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

function validateEnv() {
  const missing = [];
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (!env.db.password) missing.push('DB_PASSWORD');
  if (!env.db.connectString) missing.push('DB_CONNECT_STRING');
  if (!env.db.walletDir) missing.push('DB_WALLET_DIR');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { env, validateEnv };
