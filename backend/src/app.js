const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { env } = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const navigationRoutes = require('./routes/navigationRoutes');
const templateRoutes = require('./routes/templateRoutes');
const templateVersionRoutes = require('./routes/templateVersionRoutes');
const domainRoutes = require('./routes/domainRoutes');
const entityRoutes = require('./routes/entityRoutes');
const attributeRoutes = require('./routes/attributeRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const chainsRoutes = require('./routes/chains.routes');
const hotelsRoutes = require('./routes/hotels.routes');
const deploymentsRoutes = require('./routes/deployments.routes');
const deploymentContentRoutes = require('./routes/deploymentContent.routes');
const adminSecurityRoutes = require('./routes/adminSecurity.routes');
const passwordResetRoutes = require('./routes/passwordReset.routes');
const auditRoutes = require('./routes/audit.routes');
const appLogsRoutes = require('./routes/appLogs.routes');
const appLogger = require('./utils/appLogger');
const { requireAnyRole } = require('./middleware/requireRole');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '10mb' }));

  // V2 logging control:
  // morgan noise is only enabled from level 3 upwards.
  app.use(morgan('dev', { skip: appLogger.shouldSkipMorgan }));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/password-reset', passwordResetRoutes);
  app.use('/api/navigation', navigationRoutes);

  app.use('/api/admin', requireAnyRole(['ADMIN']), adminSecurityRoutes);
  app.use('/api/audit', requireAnyRole(['ADMIN']), auditRoutes);
  app.use('/api/logs', requireAnyRole(['ADMIN']), appLogsRoutes);

  app.use('/api/templates', requireAnyRole(['CONFIG_OPERATOR']), templateRoutes);
  app.use('/api/template-versions', requireAnyRole(['CONFIG_OPERATOR']), templateVersionRoutes);
  app.use('/api/domains', requireAnyRole(['CONFIG_OPERATOR']), domainRoutes);
  app.use('/api/entities', requireAnyRole(['CONFIG_OPERATOR']), entityRoutes);
  app.use('/api/attributes', requireAnyRole(['CONFIG_OPERATOR']), attributeRoutes);
  app.use('/api/relationships', requireAnyRole(['CONFIG_OPERATOR']), relationshipRoutes);

  app.use('/api/opera-config/deployments', deploymentsRoutes);
  app.use('/api/opera-config/deployment-content', deploymentContentRoutes);
  app.use('/api/opera-config/chains', requireAnyRole(['CHAIN_MANAGER']), chainsRoutes);
  app.use('/api/opera-config/hotels', requireAnyRole(['CHAIN_MANAGER', 'HOTEL_MANAGER']), hotelsRoutes);

  app.use(express.static(path.resolve(__dirname, '../../frontend')));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
