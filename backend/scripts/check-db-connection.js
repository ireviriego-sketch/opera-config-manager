const { validateEnv } = require('../src/config/env');
const { initOraclePool, closeOraclePool } = require('../src/db/oraclePool');
const { execute } = require('../src/db/query');

async function main() {
  validateEnv();
  await initOraclePool();
  const result = await execute('SELECT USER AS DB_USER FROM DUAL');
  console.log('Connected to Oracle as:', result.rows[0].DB_USER);
  await closeOraclePool();
}

main().catch(async (error) => {
  console.error(error);
  await closeOraclePool();
  process.exit(1);
});
