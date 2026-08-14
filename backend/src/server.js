const { createApp } = require('./app');
const { env, validateEnv } = require('./config/env');
const { initOraclePool, closeOraclePool } = require('./db/oraclePool');
const appLogger = require('./utils/appLogger');

async function start() {
  validateEnv();
  await initOraclePool();

  await appLogger.startConsoleControl();

  const app = createApp();
  const server = app.listen(env.port, () => {
    appLogger.minimal('APP', 'APP_START', `${env.appName} API running on port ${env.port}`, { port: env.port })
      .catch(error => appLogger.original().error('APP_START log failed:', error.message));
  });

  async function shutdown() {
    try {
      await appLogger.minimal('APP', 'APP_STOP', 'Application shutdown requested', {});
    } catch (error) {
      appLogger.original().error('APP_STOP log failed:', error.message);
    }

    server.close(async () => {
      appLogger.stopConsoleControl();
      await closeOraclePool();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  appLogger.original().error('Startup failed:', error);
  process.exit(1);
});
