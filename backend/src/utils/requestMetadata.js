function getRequestMetadata(req) {
  return {
    requestId: req.headers['x-request-id'] || null,
    ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
    userAgent: req.headers['user-agent'] || null
  };
}

module.exports = {
  getRequestMetadata
};
