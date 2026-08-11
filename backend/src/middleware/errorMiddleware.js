function notFoundHandler(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', path: req.originalUrl });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  res.status(error.statusCode || 500).json({
    error: error.code || 'INTERNAL_ERROR',
    message: error.message || 'Unexpected error'
  });
}

module.exports = { notFoundHandler, errorHandler };
