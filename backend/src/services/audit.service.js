const auditRepository = require('../repositories/audit.repository');
const { currentUser, currentUserId } = require('../utils/requestUser');
const { getRequestMetadata } = require('../utils/requestMetadata');
const { computeDiff } = require('../utils/objectDiff');

function getRequestAuditUser(req) {
  return {
    userId: currentUserId(req),
    username: currentUser(req, { includeName: false })
  };
}

async function logAudit(entry) {
  return auditRepository.insertAuditLog(entry);
}

async function logFromRequest(req, entry) {
  const user = getRequestAuditUser(req);
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
  const user = getRequestAuditUser(req);
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
