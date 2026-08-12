const service = require('../services/deploymentContent.service');

function currentUser(req) {
  return req.user?.email || req.user?.name || req.headers['x-user'] || null;
}

async function getStructure(req, res) {
  const structure = await service.getStructure(req.params.deploymentId);
  res.json({ ok: true, structure });
}

async function getEntityAttributes(req, res) {
  const attributes = await service.getEntityAttributes(req.params.deploymentId, req.params.entityId);
  res.json({ ok: true, rows: attributes });
}

async function listRecords(req, res) {
  const rows = await service.listRecords(req.params.deploymentId, req.params.entityId);
  res.json({ ok: true, rows });
}

async function createRecord(req, res) {
  const record = await service.createRecord(req.params.deploymentId, req.params.entityId, req.body || {}, currentUser(req));
  res.status(201).json({ ok: true, record });
}

async function updateRecord(req, res) {
  const record = await service.updateRecord(req.params.deploymentId, req.params.recordId, req.body || {}, currentUser(req));
  if (!record) return res.status(404).json({ ok: false, error: 'Record not found' });
  res.json({ ok: true, record });
}

async function deleteRecord(req, res) {
  const deleted = await service.deleteRecord(req.params.deploymentId, req.params.recordId);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Record not found' });
  res.json({ ok: true });
}

module.exports = { getStructure, getEntityAttributes, listRecords, createRecord, updateRecord, deleteRecord };
