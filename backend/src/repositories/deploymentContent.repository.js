const { execute } = require('../db/query');
const oracledb = require('oracledb');
const XLSX = require('xlsx');

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

// ─── Importación desde Excel ───────────────────────────────────────────────

function normalizeHeader(raw) {
  if (!raw) return null;
  let s = String(raw)
    .replace(/\*/g, '')
    .replace(/[\n\r]/g, ' ')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zA-Z0-9 _\-]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s || null;
}

function detectHeaderRow(worksheet) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const skipPrefixes = ['opera', 'accor', 'description', 'worksheet', 'note:', 'property specific',
    '< back', 'occs', 'package code def', 'transaction detail', 'posting attr', 'package pricing'];
  let lastHeaderRow = null;

  for (let R = 5; R <= Math.min(range.e.r, 35); R++) {
    const rowVals = [];
    for (let C = range.s.c; C <= Math.min(range.e.c, 40); C++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
      rowVals.push(cell ? cell.v : null);
    }
    const nonNull = rowVals.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (nonNull.length < 2) continue;
    const rowText = nonNull.map(v => String(v)).join(' ').toLowerCase();
    const firstVal = String(nonNull[0]).trim();
    const hasAsterisk = nonNull.some(v => String(v).includes('*'));
    if (hasAsterisk && firstVal.length < 80) { lastHeaderRow = R; continue; }
    const isGrouping = skipPrefixes.some(p => rowText.startsWith(p)) || firstVal.length > 60;
    if (isGrouping) continue;
    if (nonNull.length >= 2 && firstVal.length <= 30 && !firstVal.includes(':') &&
        !firstVal.toLowerCase().startsWith('opera') && !firstVal.toLowerCase().startsWith('accor')) {
      if (lastHeaderRow !== null) return lastHeaderRow;
    }
  }
  return lastHeaderRow;
}

function sheetBaseName(sheetName) {
  return sheetName.replace(/\s*\(Part\s+\d+\s+of\s+\d+\)/i, '').trim().toUpperCase();
}

function matchAttribute(normalizedHeader, attributes, assigned) {
  if (!normalizedHeader || normalizedHeader === 'X') return null;
  const attrCodes = attributes.map(a => (a.attributeCode || '').toUpperCase());
  const exactIdx = attrCodes.indexOf(normalizedHeader);
  if (exactIdx >= 0 && !assigned.has(attributes[exactIdx].attributeCode)) return attributes[exactIdx].attributeCode;
  const byName = attributes.find(a => !assigned.has(a.attributeCode) && normalizeHeader(a.attributeName) === normalizedHeader);
  if (byName) return byName.attributeCode;
  const prefixCandidates = attributes
    .filter(a => !assigned.has(a.attributeCode) && (a.attributeCode || '').toUpperCase().startsWith(normalizedHeader) && (a.attributeCode || '').toUpperCase() !== normalizedHeader)
    .sort((a, b) => (b.attributeCode || '').length - (a.attributeCode || '').length);
  if (prefixCandidates.length) return prefixCandidates[0].attributeCode;
  const suffixCandidates = attributes
    .filter(a => !assigned.has(a.attributeCode) && normalizedHeader.startsWith((a.attributeCode || '').toUpperCase()) && (a.attributeCode || '').toUpperCase() !== normalizedHeader)
    .sort((a, b) => (b.attributeCode || '').length - (a.attributeCode || '').length);
  if (suffixCandidates.length) return suffixCandidates[0].attributeCode;
  return null;
}

async function importDomainExcel(deploymentId, domainId, fileBuffer, userName) {
  const entitiesResult = await execute(
    `SELECT de.deployment_entity_id, de.entity_code, de.entity_name
       FROM opera_cfg_chain_deployment_entities de
      WHERE de.chain_deployment_id = :deploymentId
        AND de.deployment_domain_id = :domainId
      ORDER BY NVL(de.sort_order, de.deployment_entity_id)`,
    { deploymentId: Number(deploymentId), domainId: Number(domainId) }
  );
  if (!entitiesResult.rows.length) return { inserted: 0, skipped: 0, errors: ['No se encontraron entidades para este dominio.'] };

  const entityAttributesMap = new Map();
  for (const row of entitiesResult.rows) {
    const attrResult = await execute(
      `SELECT attribute_code, attribute_name, is_required
         FROM opera_cfg_chain_deployment_attributes
        WHERE chain_deployment_id = :deploymentId
          AND deployment_entity_id = :entityId
        ORDER BY NVL(sort_order, deployment_attribute_id)`,
      { deploymentId: Number(deploymentId), entityId: Number(row.DEPLOYMENT_ENTITY_ID) }
    );
    entityAttributesMap.set(Number(row.DEPLOYMENT_ENTITY_ID), attrResult.rows.map(a => ({
      attributeCode: a.ATTRIBUTE_CODE, attributeName: a.ATTRIBUTE_NAME, isRequired: a.IS_REQUIRED
    })));
  }

  const entityMap = new Map();
  for (const row of entitiesResult.rows) {
    const entityId = Number(row.DEPLOYMENT_ENTITY_ID);
    const data = { entityId, entityName: row.ENTITY_NAME, attributes: entityAttributesMap.get(entityId) || [] };
    entityMap.set((row.ENTITY_NAME || '').toUpperCase(), data);
    if (row.ENTITY_CODE) entityMap.set((row.ENTITY_CODE || '').toUpperCase(), data);
  }

  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  let inserted = 0, skipped = 0;
  const errors = [], processedSheets = new Set();
  const skipSheets = new Set(['DROPDOWNS-DO NOT DELETE', 'TEMPLATE 1', 'TEMPLATE 2', 'VERSION CONTROL',
    'OCCS DETAILS', 'COPYRIGHT', 'PROPERTY INFORMATION', 'OVERVIEW & INSTRUCTIONS',
    'MENU DESCRIPTIONS', 'TABLE OF CONTENTS', 'CONFIGURATION CHECKLIST', 'BLANK WORKSHEET', 'ABOUT TRANSACTION CODES']);

  for (const sheetName of workbook.SheetNames) {
    const baseName = sheetBaseName(sheetName);
    if (skipSheets.has(baseName)) continue;
    let entityData = entityMap.get(baseName);
    if (!entityData) {
      for (const [key, val] of entityMap.entries()) {
        if (baseName.startsWith(key) || key.startsWith(baseName)) { entityData = val; break; }
      }
    }
    if (!entityData) continue;
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet || !worksheet['!ref']) continue;
    const headerRowIdx = detectHeaderRow(worksheet);
    if (headerRowIdx === null) { errors.push(`"${sheetName}": no se detectó fila de headers.`); skipped++; continue; }
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const rawHeaders = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
      rawHeaders.push(cell ? String(cell.v || '') : null);
    }
    const assignedAttrs = new Set();
    const colToAttr = rawHeaders.map(h => {
      const normalized = normalizeHeader(h);
      if (!normalized || normalized === 'X') return null;
      const match = matchAttribute(normalized, entityData.attributes, assignedAttrs);
      if (match) assignedAttrs.add(match);
      return match;
    });
    if (!colToAttr.some(a => a !== null)) { errors.push(`"${sheetName}": ninguna columna coincide.`); skipped++; continue; }
    let sheetInserted = 0;
    for (let R = headerRowIdx + 1; R <= range.e.r; R++) {
      const record = {}; let hasData = false;
      for (let C = range.s.c; C <= range.e.c; C++) {
        const colIdx = C - range.s.c;
        const attrCode = colToAttr[colIdx];
        if (!attrCode) continue;
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (!cell || cell.v === null || cell.v === undefined) continue;
        let val = cell.t === 'd' ? cell.v.toISOString().split('T')[0] : String(cell.v).trim();
        if (val === 'X' || val === 'x' || val === '') continue;
        record[attrCode] = val; hasData = true;
      }
      if (!hasData) continue;
      try {
        await execute(
          `INSERT INTO opera_cfg_chain_deployment_records (chain_deployment_id, deployment_entity_id, record_json, status, created_by)
           VALUES (:deploymentId, :entityId, :recordJson, 'DRAFT', :createdBy)`,
          { deploymentId: Number(deploymentId), entityId: entityData.entityId, recordJson: JSON.stringify(record, null, 2), createdBy: userName || null },
          { autoCommit: true }
        );
        inserted++; sheetInserted++;
      } catch (err) { skipped++; errors.push(`"${sheetName}" fila ${R + 1}: ${err.message}`); }
    }
    if (sheetInserted > 0) processedSheets.add(`${entityData.entityName} (${sheetInserted} registros)`);
  }
  return { inserted, skipped, errors, processedSheets: Array.from(processedSheets) };
}

module.exports = { getStructure, getEntityAttributes, listRecords, createRecord, updateRecord, deleteRecord, deleteEntityRecords, importDomainExcel };
