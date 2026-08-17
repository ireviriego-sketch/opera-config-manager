const auditService = require('../services/audit.service');

async function auditSafely(req, entry) {
  try {
    await auditService.logFromRequest(req, entry);
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
}

module.exports = {
  auditSafely
};
