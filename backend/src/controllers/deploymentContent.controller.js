const service = require('../services/deploymentContent.service');
const { auditSafely } = require('../utils/auditHelper');
const { currentUser } = require('../utils/requestUser');

function recordName(record, fallbackRecordId, fallbackEntityId) {
  const id = record?.deploymentRecordId || record?.DEPLOYMENT_RECORD_ID || fallbackRecordId || 'registro';
  const entityId = record?.deploymentEntityId || record?.DEPLOYMENT_ENTITY_ID || fallbackEntityId || 'entidad';
  return `Registro ${id} / Entidad ${entityId}`;
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

  await auditSafely(req, {
    username: currentUser(req),
    action: 'CREATE_DEPLOYMENT_RECORD',
    actionCode: 'CREATE_DEPLOYMENT_RECORD',
    resultStatus: 'SUCCESS',
    entityType: 'DEPLOYMENT_RECORD',
    entityId: record?.deploymentRecordId || record?.DEPLOYMENT_RECORD_ID,
    entityName: recordName(record, null, req.params.entityId),
    summary: `Registro de despliegue creado: ${recordName(record, null, req.params.entityId)}`,
    oldValues: null,
    newValues: record,
    details: {
      deploymentId: Number(req.params.deploymentId),
      deploymentEntityId: Number(req.params.entityId)
    }
  });

  res.status(201).json({ ok: true, record });
}

async function updateRecord(req, res) {
  const record = await service.updateRecord(req.params.deploymentId, req.params.recordId, req.body || {}, currentUser(req));
  if (!record) return res.status(404).json({ ok: false, error: 'Record not found' });

  await auditSafely(req, {
    username: currentUser(req),
    action: 'UPDATE_DEPLOYMENT_RECORD',
    actionCode: 'UPDATE_DEPLOYMENT_RECORD',
    resultStatus: 'SUCCESS',
    entityType: 'DEPLOYMENT_RECORD',
    entityId: record?.deploymentRecordId || record?.DEPLOYMENT_RECORD_ID || req.params.recordId,
    entityName: recordName(record, req.params.recordId, null),
    summary: `Registro de despliegue actualizado: ${recordName(record, req.params.recordId, null)}`,
    oldValues: null,
    newValues: record,
    details: {
      deploymentId: Number(req.params.deploymentId),
      deploymentRecordId: Number(req.params.recordId)
    }
  });

  res.json({ ok: true, record });
}

async function deleteRecord(req, res) {
  const deleted = await service.deleteRecord(req.params.deploymentId, req.params.recordId);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Record not found' });

  await auditSafely(req, {
    username: currentUser(req),
    action: 'DELETE_DEPLOYMENT_RECORD',
    actionCode: 'DELETE_DEPLOYMENT_RECORD',
    resultStatus: 'SUCCESS',
    entityType: 'DEPLOYMENT_RECORD',
    entityId: req.params.recordId,
    entityName: recordName(null, req.params.recordId, null),
    summary: `Registro de despliegue eliminado: ${recordName(null, req.params.recordId, null)}`,
    oldValues: null,
    newValues: { deleted: true, deploymentRecordId: Number(req.params.recordId) },
    details: {
      deploymentId: Number(req.params.deploymentId),
      deploymentRecordId: Number(req.params.recordId)
    }
  });

  res.json({ ok: true });
}

async function deleteEntityRecords(req, res) {
  const before = await service.listRecords(req.params.deploymentId, req.params.entityId);
  const deleted = await service.deleteEntityRecords(req.params.deploymentId, req.params.entityId);

  await auditSafely(req, {
    username: currentUser(req),
    action: 'DELETE_DEPLOYMENT_ENTITY_RECORDS',
    actionCode: 'DELETE_DEPLOYMENT_ENTITY_RECORDS',
    resultStatus: 'SUCCESS',
    entityType: 'DEPLOYMENT_RECORD',
    entityId: req.params.entityId,
    entityName: `Entidad ${req.params.entityId}`,
    summary: `Registros de entidad eliminados: ${deleted}`,
    oldValues: { records: before },
    newValues: { deletedCount: deleted },
    details: {
      deploymentId: Number(req.params.deploymentId),
      deploymentEntityId: Number(req.params.entityId)
    }
  });

  res.json({ ok: true, deleted });
}

async function importDomainExcel(req, res) {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo.' });

  const result = await service.importDomainExcel(
    req.params.deploymentId,
    req.params.domainId,
    req.file.buffer,
    currentUser(req)
  );

  await auditSafely(req, {
    username: currentUser(req),
    action: 'IMPORT_DEPLOYMENT_DOMAIN_EXCEL',
    actionCode: 'IMPORT_DEPLOYMENT_DOMAIN_EXCEL',
    resultStatus: 'SUCCESS',
    entityType: 'DEPLOYMENT_IMPORT',
    entityId: req.params.domainId,
    entityName: `Dominio ${req.params.domainId}`,
    summary: `Excel importado para dominio de despliegue ${req.params.domainId}`,
    oldValues: null,
    newValues: result,
    details: {
      deploymentId: Number(req.params.deploymentId),
      domainId: Number(req.params.domainId),
      fileName: req.file.originalname
    }
  });

  res.json({ ok: true, ...result });
}

module.exports = {
  getStructure,
  getEntityAttributes,
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  deleteEntityRecords,
  importDomainExcel
};
