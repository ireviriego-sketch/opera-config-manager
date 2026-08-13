const oracledb = require('oracledb');
const { env } = require('../config/env');

let pool;

async function initOraclePool() {
  if (pool) return pool;

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false;

  pool = await oracledb.createPool({
    user: env.db.user,
    password: env.db.password,
    connectString: env.db.connectString,
    walletLocation: env.db.walletDir,
    configDir: env.db.walletDir,
    walletPassword: process.env.DB_WALLET_PASSWORD,
    poolMin: env.db.poolMin,
    poolMax: env.db.poolMax,
    poolIncrement: env.db.poolIncrement,
    queueTimeout: 300000,
    poolTimeout: 120,
    poolPingInterval: 60
  });

  return pool;
}

async function getConnection() {
  if (!pool) await initOraclePool();
  return pool.getConnection();
}

async function closeOraclePool() {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}

module.exports = { initOraclePool, getConnection, closeOraclePool };
