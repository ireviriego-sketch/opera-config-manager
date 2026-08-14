const auditRepository = require('../repositories/audit.repository');

async function listAuditLogs(req, res, next) {
  try {
    const items = await auditRepository.findAuditLogs({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      username: req.query.username,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      resultStatus: req.query.resultStatus,
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

async function getAuditLog(req, res, next) {
  try {
    const item = await auditRepository.findAuditLogById(req.params.auditId);
    if (!item) return res.status(404).json({ message: 'Audit entry not found' });
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

module.exports = { listAuditLogs, getAuditLog };
