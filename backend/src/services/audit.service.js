const auditRepository = require('../repositories/audit.repository');

function getRequestUser(req) {
  return {
    userId: req.authzUserId || req.user?.userId || req.user?.USER_ID || null,
    username: req.user?.username || req.user?.USERNAME || req.user?.email || req.headers['x-user'] || req.headers['x-username'] || 'system'
  };
}

function getRequestMetadata(req) {
  return {
    requestId: req.headers['x-request-id'] || null,
    ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
    userAgent: req.headers['user-agent'] || null
  };
}

function computeDiff(oldValues, newValues) {
  if (!oldValues || !newValues || typeof oldValues !== 'object' || typeof newValues !== 'object') return null;

  const diff = {};
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of keys) {
    const before = oldValues[key];
    const after = newValues[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[key] = { before, after };
    }
  }

  return Object.keys(diff).length ? diff : null;
}

async function logAudit(entry) {
  return auditRepository.insertAuditLog(entry);
}

async function logFromRequest(req, entry) {
  const user = getRequestUser(req);
  const metadata = getRequestMetadata(req);

  return logAudit({
    ...metadata,
    ...entry,
    userId: entry.userId || user.userId,
    username: entry.username || user.username,
    resultStatus: entry.resultStatus || 'SUCCESS',
    changeDiff: entry.changeDiff || computeDiff(entry.oldValues, entry.newValues)
  });
}

async function logFailureFromRequest(req, entry, error) {
  const user = getRequestUser(req);
  const metadata = getRequestMetadata(req);

  return logAudit({
    ...metadata,
    ...entry,
    userId: entry.userId || user.userId,
    username: entry.username || user.username,
    resultStatus: 'FAILED',
    summary: entry.summary || error?.message || 'Operación fallida',
    details: {
      error: error?.message || String(error),
      stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack
    }
  });
}

async function listAuditLogs(filters) {
  return auditRepository.findAuditLogs(filters);
}

async function getAuditLog(auditId) {
  return auditRepository.findAuditLogById(auditId);
}

module.exports = {
  computeDiff,
  logAudit,
  logFromRequest,
  logFailureFromRequest,
  listAuditLogs,
  getAuditLog
};
