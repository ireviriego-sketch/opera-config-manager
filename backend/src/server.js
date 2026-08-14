const { createApp } = require('./app');
const { env, validateEnv } = require('./config/env');
const { initOraclePool, closeOraclePool } = require('./db/oraclePool');
const adminSecurityRoutes = require('./routes/adminSecurity.routes');

async function start() {
  validateEnv();
  await initOraclePool();

  const app = createApp();

  app.use('/api/admin', adminSecurityRoutes);

  const server = app.listen(env.port, () => {
    console.log(`${env.appName} API running on port ${env.port}`);
  });

  async function shutdown() {
    console.log('Shutting down...');
    server.close(async () => {
      await closeOraclePool();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});