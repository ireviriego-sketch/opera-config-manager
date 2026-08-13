const repository = require('../repositories/deploymentContent.repository');

async function getStructure(deploymentId) { return repository.getStructure(deploymentId); }
async function getEntityAttributes(deploymentId, entityId) { return repository.getEntityAttributes(deploymentId, entityId); }
async function listRecords(deploymentId, entityId) { return repository.listRecords(deploymentId, entityId); }
async function createRecord(deploymentId, entityId, body, userName) { return repository.createRecord(deploymentId, entityId, body.record || {}, userName || null); }
async function updateRecord(deploymentId, recordId, body, userName) { return repository.updateRecord(deploymentId, recordId, body.record || {}, userName || null); }
async function deleteRecord(deploymentId, recordId) { return repository.deleteRecord(deploymentId, recordId); }

async function importDomainExcel(deploymentId, domainId, fileBuffer, userName) {
  return repository.importDomainExcel(deploymentId, domainId, fileBuffer, userName);
}

module.exports = { getStructure, getEntityAttributes, listRecords, createRecord, updateRecord, deleteRecord, importDomainExcel };
