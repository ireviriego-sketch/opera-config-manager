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

const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/navigation', navigationRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/template-versions', templateVersionRoutes);
  app.use('/api/domains', domainRoutes);
  app.use('/api/entities', entityRoutes);
  app.use('/api/attributes', attributeRoutes);
  app.use('/api/relationships', relationshipRoutes);
  app.use('/api/opera-config/chains', chainsRoutes);
  app.use('/api/opera-config/hotels', hotelsRoutes);
  app.use('/api/opera-config/deployments', deploymentsRoutes);
  app.use('/api/opera-config/deployment-content', deploymentContentRoutes);
  app.use(express.static(path.resolve(__dirname, '../../frontend')));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
