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

  const recordCounts = await execute(
    `SELECT deployment_entity_id, COUNT(*) AS record_count
       FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :deploymentId
      GROUP BY deployment_entity_id`,
    { deploymentId: Number(deploymentId) }
  );

  const countsByEntity = new Map(recordCounts.rows.map(row => [Number(row.DEPLOYMENT_ENTITY_ID), Number(row.RECORD_COUNT || 0)]));
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
    entitiesByDomain.get(key).push({
      deploymentEntityId: entityId,
      sourceEntityId: row.SOURCE_ENTITY_ID,
      entityCode: row.ENTITY_CODE,
      entityName: row.ENTITY_NAME,
      status: row.STATUS,
      recordCount: countsByEntity.get(entityId) || 0,
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

// ─── Importación desde Excel ───────────────────────────────────────────────

/**
 * Limpia un header del Excel para compararlo con nombres de atributos.
 * Estrategia: quitar asteriscos y paréntesis, normalizar espacios/saltos,
 * reemplazar espacios por _ y convertir a mayúsculas.
 * NO elimina texto después del guion para preservar sufijos como "Numeric 8".
 */
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

/**
 * Genera variantes de un header normalizado para aumentar las posibilidades de match.
 * Ejemplo: "CODE_NUMERIC_8" → ["CODE_NUMERIC_8", "CODE_NUMERIC", "CODE"]
 */
function headerVariants(normalized) {
  if (!normalized) return [];
  const parts = normalized.split('_');
  const variants = [normalized];
  // Versión sin el último token numérico o descriptivo
  if (parts.length > 1) variants.push(parts.slice(0, -1).join('_'));
  // Solo el primer token
  if (parts.length > 2) variants.push(parts[0]);
  return variants;
}

/**
 * Detecta la fila de headers buscando la primera fila después de la fila 10
 * con al menos 3 valores no nulos, cuyo primer valor no sea instrucciones largas.
 */
function detectHeaderRow(worksheet) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  // Estrategia: buscar la última fila con asterisco (*) antes de la primera fila de datos reales
  // Una fila de datos reales es aquella cuya col A tiene un valor corto sin asterisco ni palabras clave
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

    // Es una fila de headers si contiene asteriscos
    const hasAsterisk = nonNull.some(v => String(v).includes('*'));
    if (hasAsterisk && firstVal.length < 80) {
      lastHeaderRow = R;
      continue;
    }

    // Es una fila de agrupación/título (ignorar)
    const isGrouping = skipPrefixes.some(p => rowText.startsWith(p)) || firstVal.length > 60;
    if (isGrouping) continue;

    // Es una fila de datos reales: col A tiene valor corto sin texto descriptivo largo
    // y la fila tiene múltiples valores
    if (nonNull.length >= 2 && firstVal.length <= 30 && !firstVal.includes(':') &&
        !firstVal.toLowerCase().startsWith('opera') && !firstVal.toLowerCase().startsWith('accor')) {
      // Los datos empiezan aquí — devolver el último header encontrado
      if (lastHeaderRow !== null) return lastHeaderRow;
    }
  }

  return lastHeaderRow;
}

/**
 * Nombre base de una hoja para matching con entidades.
 * "Transportation (Part 1 of 2)" → "TRANSPORTATION"
 */
function sheetBaseName(sheetName) {
  return sheetName
    .replace(/\s*\(Part\s+\d+\s+of\s+\d+\)/i, '')
    .trim()
    .toUpperCase();
}

/**
 * Hace matching entre header normalizado y atributos de la entidad.
 * Prioriza el match más específico (más largo) para evitar que "CODE" 
 * gane sobre "CODE_NUMERIC_8".
 */
function matchAttribute(normalizedHeader, attributes, assigned) {
  if (!normalizedHeader || normalizedHeader === 'X') return null;
  const attrCodes = attributes.map(a => (a.attributeCode || '').toUpperCase());

  // 1. Match exacto
  const exactIdx = attrCodes.indexOf(normalizedHeader);
  if (exactIdx >= 0 && !assigned.has(attributes[exactIdx].attributeCode)) {
    return attributes[exactIdx].attributeCode;
  }

  // 2. Match por nombre de atributo normalizado
  const byName = attributes.find(a =>
    !assigned.has(a.attributeCode) && normalizeHeader(a.attributeName) === normalizedHeader
  );
  if (byName) return byName.attributeCode;

  // 3. El header es prefijo del atributo (ej: CODE_NUMERIC → CODE_NUMERIC_8)
  // Preferir el match más largo
  const prefixCandidates = attributes
    .filter(a => !assigned.has(a.attributeCode) &&
      (a.attributeCode || '').toUpperCase().startsWith(normalizedHeader) &&
      (a.attributeCode || '').toUpperCase() !== normalizedHeader)
    .sort((a, b) => (b.attributeCode || '').length - (a.attributeCode || '').length);
  if (prefixCandidates.length) return prefixCandidates[0].attributeCode;

  // 4. El atributo es prefijo del header (ej: SERVICE_RECOVERY_CODE → SERVICE_RECOVERY_CODE_OPTIONAL)
  const suffixCandidates = attributes
    .filter(a => !assigned.has(a.attributeCode) &&
      normalizedHeader.startsWith((a.attributeCode || '').toUpperCase()) &&
      (a.attributeCode || '').toUpperCase() !== normalizedHeader)
    .sort((a, b) => (b.attributeCode || '').length - (a.attributeCode || '').length);
  if (suffixCandidates.length) return suffixCandidates[0].attributeCode;

  return null;
}

async function importDomainExcel(deploymentId, domainId, fileBuffer, userName) {
  // 1. Obtener entidades del dominio
  const entitiesResult = await execute(
    `SELECT de.deployment_entity_id, de.entity_code, de.entity_name
       FROM opera_cfg_chain_deployment_entities de
      WHERE de.chain_deployment_id = :deploymentId
        AND de.deployment_domain_id = :domainId
      ORDER BY NVL(de.sort_order, de.deployment_entity_id)`,
    { deploymentId: Number(deploymentId), domainId: Number(domainId) }
  );

  if (!entitiesResult.rows.length) {
    return { inserted: 0, skipped: 0, errors: ['No se encontraron entidades para este dominio.'] };
  }

  // 2. Obtener atributos de cada entidad
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
      attributeCode: a.ATTRIBUTE_CODE,
      attributeName: a.ATTRIBUTE_NAME,
      isRequired: a.IS_REQUIRED
    })));
  }

  // 3. Construir mapa nombre_entidad → datos
  const entityMap = new Map();
  for (const row of entitiesResult.rows) {
    const entityId = Number(row.DEPLOYMENT_ENTITY_ID);
    const data = {
      entityId,
      entityName: row.ENTITY_NAME,
      attributes: entityAttributesMap.get(entityId) || []
    };
    entityMap.set((row.ENTITY_NAME || '').toUpperCase(), data);
    if (row.ENTITY_CODE) entityMap.set((row.ENTITY_CODE || '').toUpperCase(), data);
  }

  // 4. Leer el Excel
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

  let inserted = 0;
  let skipped = 0;
  const errors = [];
  const processedSheets = new Set();

  const skipSheets = new Set([
    'DROPDOWNS-DO NOT DELETE', 'TEMPLATE 1', 'TEMPLATE 2', 'VERSION CONTROL',
    'OCCS DETAILS', 'COPYRIGHT', 'PROPERTY INFORMATION', 'OVERVIEW & INSTRUCTIONS',
    'MENU DESCRIPTIONS', 'TABLE OF CONTENTS', 'CONFIGURATION CHECKLIST',
    'BLANK WORKSHEET', 'ABOUT TRANSACTION CODES'
  ]);

  for (const sheetName of workbook.SheetNames) {
    const baseName = sheetBaseName(sheetName);
    if (skipSheets.has(baseName)) continue;

    // Buscar entidad por nombre exacto primero, luego parcial
    let entityData = entityMap.get(baseName);
    if (!entityData) {
      for (const [key, val] of entityMap.entries()) {
        if (baseName.startsWith(key) || key.startsWith(baseName)) {
          entityData = val;
          break;
        }
      }
    }
    if (!entityData) continue;

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet || !worksheet['!ref']) continue;

    // Detectar fila de headers
    const headerRowIdx = detectHeaderRow(worksheet);
    if (headerRowIdx === null) {
      errors.push(`"${sheetName}": no se detectó fila de headers — omitida.`);
      skipped++;
      continue;
    }

    // Leer headers
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const rawHeaders = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIdx, c: C })];
      rawHeaders.push(cell ? String(cell.v || '') : null);
    }

    // Mapear columna → attributeCode
    // Rastrear qué atributos ya están asignados para evitar duplicados
    const assignedAttrs = new Set();
    const colToAttr = rawHeaders.map(h => {
      const normalized = normalizeHeader(h);
      if (!normalized || normalized === 'X') return null;
      const match = matchAttribute(normalized, entityData.attributes, assignedAttrs);
      if (match) assignedAttrs.add(match);
      return match;
    });

    const hasAnyMatch = colToAttr.some(a => a !== null);
    if (!hasAnyMatch) {
      errors.push(`"${sheetName}": ninguna columna coincide con atributos — omitida.`);
      skipped++;
      continue;
    }

    // Leer filas de datos
    let sheetInserted = 0;
    for (let R = headerRowIdx + 1; R <= range.e.r; R++) {
      const record = {};
      let hasData = false;

      for (let C = range.s.c; C <= range.e.c; C++) {
        const colIdx = C - range.s.c;
        const attrCode = colToAttr[colIdx];
        if (!attrCode) continue;

        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (!cell || cell.v === null || cell.v === undefined) continue;

        let val;
        if (cell.t === 'd') {
          val = cell.v.toISOString().split('T')[0];
        } else {
          val = String(cell.v).trim();
        }

        // Ignorar valores que son solo "X" (columnas de selección del Excel)
        if (val === 'X' || val === 'x') continue;

        if (val !== '') {
          record[attrCode] = val;
          hasData = true;
        }
      }

      if (!hasData) continue;

      try {
        await execute(
          `INSERT INTO opera_cfg_chain_deployment_records
             (chain_deployment_id, deployment_entity_id, record_json, status, created_by)
           VALUES
             (:deploymentId, :entityId, :recordJson, 'DRAFT', :createdBy)`,
          {
            deploymentId: Number(deploymentId),
            entityId: entityData.entityId,
            recordJson: JSON.stringify(record, null, 2),
            createdBy: userName || null
          },
          { autoCommit: true }
        );
        inserted++;
        sheetInserted++;
      } catch (err) {
        skipped++;
        errors.push(`"${sheetName}" fila ${R + 1}: ${err.message}`);
      }
    }

    if (sheetInserted > 0) processedSheets.add(`${entityData.entityName} (${sheetInserted} registros)`);
  }

  return { inserted, skipped, errors, processedSheets: Array.from(processedSheets) };
}

module.exports = { getStructure, getEntityAttributes, listRecords, createRecord, updateRecord, deleteRecord, importDomainExcel };
