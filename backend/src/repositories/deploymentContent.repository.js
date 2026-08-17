const { execute } = require('../db/query');
const oracledb = require('oracledb');
const { importDomainExcel } = require('./deploymentContentExcel.repository');

async function parseJsonClob(value) {
  if (!value) return null;
  if (typeof value === 'string') return JSON.parse(value);
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8'));
  if (typeof value.getData === 'function') {
    const text = await value.getData();
    return JSON.parse(text);
  }
  return JSON.parse(String(value));
}

async function getStructure(deploymentId) {
  const domains = await execute(
    `SELECT deployment_domain_id, source_domain_id, domain_code, domain_name, status, sort_order
       FROM opera_cfg_chain_deployment_domains
      WHERE chain_deployment_id = :deploymentId
      ORDER BY NVL(sort_order, deployment_domain_id)`,
    { deploymentId: Number(deploymentId) }
  );

  const entities = await execute(
    `SELECT deployment_entity_id, deployment_domain_id, source_entity_id, entity_code, entity_name, status, sort_order
       FROM opera_cfg_chain_deployment_entities
      WHERE chain_deployment_id = :deploymentId
      ORDER BY deployment_domain_id, NVL(sort_order, deployment_entity_id)`,
    { deploymentId: Number(deploymentId) }
  );

  const attrs = await execute(
    `SELECT deployment_attribute_id, deployment_entity_id, source_attribute_id, attribute_code, attribute_name, data_type, is_required, default_value, status, sort_order
       FROM opera_cfg_chain_deployment_attributes
      WHERE chain_deployment_id = :deploymentId
      ORDER BY deployment_entity_id, NVL(sort_order, deployment_attribute_id)`,
    { deploymentId: Number(deploymentId) }
  );

  // Conteos totales por entidad
  const recordCounts = await execute(
    `SELECT deployment_entity_id, COUNT(*) AS record_count
       FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :deploymentId
      GROUP BY deployment_entity_id`,
    { deploymentId: Number(deploymentId) }
  );

  // Conteos por status por entidad
  const recordCountsByStatus = await execute(
    `SELECT deployment_entity_id, status, COUNT(*) AS cnt
       FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :deploymentId
      GROUP BY deployment_entity_id, status`,
    { deploymentId: Number(deploymentId) }
  );

  const countsByEntity = new Map(recordCounts.rows.map(row => [Number(row.DEPLOYMENT_ENTITY_ID), Number(row.RECORD_COUNT || 0)]));

  // Mapa: entityId -> { IMPORTED: N, ERROR: N, DRAFT: N, ... }
  const statusCountsByEntity = new Map();
  recordCountsByStatus.rows.forEach(row => {
    const entityId = Number(row.DEPLOYMENT_ENTITY_ID);
    if (!statusCountsByEntity.has(entityId)) statusCountsByEntity.set(entityId, {});
    statusCountsByEntity.get(entityId)[row.STATUS] = Number(row.CNT || 0);
  });

  const attrsByEntity = new Map();
  attrs.rows.forEach(row => {
    const key = Number(row.DEPLOYMENT_ENTITY_ID);
    if (!attrsByEntity.has(key)) attrsByEntity.set(key, []);
    attrsByEntity.get(key).push({
      deploymentAttributeId: row.DEPLOYMENT_ATTRIBUTE_ID,
      sourceAttributeId: row.SOURCE_ATTRIBUTE_ID,
      attributeCode: row.ATTRIBUTE_CODE,
      attributeName: row.ATTRIBUTE_NAME,
      dataType: row.DATA_TYPE,
      isRequired: row.IS_REQUIRED,
      defaultValue: row.DEFAULT_VALUE,
      status: row.STATUS
    });
  });

  const entitiesByDomain = new Map();
  entities.rows.forEach(row => {
    const key = Number(row.DEPLOYMENT_DOMAIN_ID || 0);
    if (!entitiesByDomain.has(key)) entitiesByDomain.set(key, []);
    const entityId = Number(row.DEPLOYMENT_ENTITY_ID);
    const statusCounts = statusCountsByEntity.get(entityId) || {};
    const total = countsByEntity.get(entityId) || 0;
    const imported = statusCounts['IMPORTED'] || 0;
    const errors = statusCounts['ERROR'] || 0;

    // importStatus: 'none' | 'partial' | 'full'
    let importStatus = 'none';
    if (total > 0 && imported === total) importStatus = 'full';
    else if (total > 0 && (imported > 0 || errors > 0)) importStatus = 'partial';

    entitiesByDomain.get(key).push({
      deploymentEntityId: entityId,
      sourceEntityId: row.SOURCE_ENTITY_ID,
      entityCode: row.ENTITY_CODE,
      entityName: row.ENTITY_NAME,
      status: row.STATUS,
      recordCount: total,
      importedCount: imported,
      errorCount: errors,
      importStatus,
      attributes: attrsByEntity.get(entityId) || []
    });
  });

  return domains.rows.map(row => ({
    deploymentDomainId: row.DEPLOYMENT_DOMAIN_ID,
    sourceDomainId: row.SOURCE_DOMAIN_ID,
    domainCode: row.DOMAIN_CODE,
    domainName: row.DOMAIN_NAME,
    status: row.STATUS,
    entities: entitiesByDomain.get(Number(row.DEPLOYMENT_DOMAIN_ID)) || []
  }));
}

async function getEntityAttributes(deploymentId, entityId) {
  const result = await execute(
    `SELECT deployment_attribute_id, source_attribute_id, attribute_code, attribute_name, data_type, is_required, default_value, status, sort_order
       FROM opera_cfg_chain_deployment_attributes
      WHERE chain_deployment_id = :deploymentId
        AND deployment_entity_id = :entityId
      ORDER BY NVL(sort_order, deployment_attribute_id)`,
    { deploymentId: Number(deploymentId), entityId: Number(entityId) }
  );

  return result.rows.map(row => ({
    deploymentAttributeId: row.DEPLOYMENT_ATTRIBUTE_ID,
    sourceAttributeId: row.SOURCE_ATTRIBUTE_ID,
    attributeCode: row.ATTRIBUTE_CODE,
    attributeName: row.ATTRIBUTE_NAME,
    dataType: row.DATA_TYPE,
    isRequired: row.IS_REQUIRED,
    defaultValue: row.DEFAULT_VALUE,
    status: row.STATUS
  }));
}

async function mapRecord(row) {
  return {
    deploymentRecordId: row.DEPLOYMENT_RECORD_ID,
    chainDeploymentId: row.CHAIN_DEPLOYMENT_ID,
    deploymentEntityId: row.DEPLOYMENT_ENTITY_ID,
    record: await parseJsonClob(row.RECORD_JSON),
    status: row.STATUS,
    createdAt: row.CREATED_AT,
    createdBy: row.CREATED_BY,
    updatedAt: row.UPDATED_AT,
    updatedBy: row.UPDATED_BY
  };
}

async function listRecords(deploymentId, entityId) {
  const result = await execute(
    `SELECT deployment_record_id, chain_deployment_id, deployment_entity_id, record_json, status, created_at, created_by, updated_at, updated_by
       FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :deploymentId
        AND deployment_entity_id = :entityId
      ORDER BY deployment_record_id`,
    { deploymentId: Number(deploymentId), entityId: Number(entityId) }
  );

  const mapped = [];
  for (const row of result.rows) mapped.push(await mapRecord(row));
  return mapped;
}

async function getRecord(deploymentId, recordId) {
  const result = await execute(
    `SELECT deployment_record_id, chain_deployment_id, deployment_entity_id, record_json, status, created_at, created_by, updated_at, updated_by
       FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :deploymentId
        AND deployment_record_id = :recordId`,
    { deploymentId: Number(deploymentId), recordId: Number(recordId) }
  );
  return result.rows[0] ? mapRecord(result.rows[0]) : null;
}

async function createRecord(deploymentId, entityId, record, userName) {
  const result = await execute(
    `INSERT INTO opera_cfg_chain_deployment_records
       (chain_deployment_id, deployment_entity_id, record_json, status, created_by)
     VALUES
       (:deploymentId, :entityId, :recordJson, 'DRAFT', :createdBy)
     RETURNING deployment_record_id INTO :recordId`,
    {
      deploymentId: Number(deploymentId),
      entityId: Number(entityId),
      recordJson: JSON.stringify(record || {}, null, 2),
      createdBy: userName || null,
      recordId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
    { autoCommit: true }
  );
  return getRecord(deploymentId, result.outBinds.recordId[0]);
}

async function updateRecord(deploymentId, recordId, record, userName) {
  const result = await execute(
    `UPDATE opera_cfg_chain_deployment_records
        SET record_json = :recordJson,
            updated_at = SYSTIMESTAMP,
            updated_by = :updatedBy
      WHERE chain_deployment_id = :deploymentId
        AND deployment_record_id = :recordId`,
    {
      deploymentId: Number(deploymentId),
      recordId: Number(recordId),
      recordJson: JSON.stringify(record || {}, null, 2),
      updatedBy: userName || null
    },
    { autoCommit: true }
  );
  if (!result.rowsAffected) return null;
  return getRecord(deploymentId, recordId);
}

async function deleteRecord(deploymentId, recordId) {
  const result = await execute(
    `DELETE FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :deploymentId
        AND deployment_record_id = :recordId`,
    { deploymentId: Number(deploymentId), recordId: Number(recordId) },
    { autoCommit: true }
  );
  return !!result.rowsAffected;
}

async function deleteEntityRecords(deploymentId, entityId) {
  const result = await execute(
    `DELETE FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :deploymentId
        AND deployment_entity_id = :entityId`,
    { deploymentId: Number(deploymentId), entityId: Number(entityId) },
    { autoCommit: true }
  );
  return result.rowsAffected || 0;
}

module.exports = { getStructure, getEntityAttributes, listRecords, createRecord, updateRecord, deleteRecord, deleteEntityRecords, importDomainExcel };
