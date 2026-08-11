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

  app.use(express.static(path.resolve(__dirname, '../../frontend')));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
