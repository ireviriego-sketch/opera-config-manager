const oracledb = require('oracledb');
const { execute, executeTransaction } = require('../db/query');

function mapVersion(row) {
  return {
    VERSION_ID: row.VERSION_ID,
    TEMPLATE_ID: row.TEMPLATE_ID,
    VERSION_NUMBER: row.VERSION_NUMBER,
    VERSION_LABEL: row.VERSION_LABEL,
    VERSION_STATUS: row.VERSION_STATUS,
    IS_ACTIVE: row.IS_ACTIVE,
    BASE_VERSION_ID: row.BASE_VERSION_ID,
    ACTIVATED_AT: row.ACTIVATED_AT,
    ACTIVATED_BY: row.ACTIVATED_BY,
    CREATED_AT: row.CREATED_AT,
    CREATED_BY: row.CREATED_BY,
    UPDATED_AT: row.UPDATED_AT,
    UPDATED_BY: row.UPDATED_BY,
    versionId: row.VERSION_ID,
    templateId: row.TEMPLATE_ID,
    versionNumber: row.VERSION_NUMBER,
    versionLabel: row.VERSION_LABEL,
    versionStatus: row.VERSION_STATUS,
    isActive: row.IS_ACTIVE
  };
}

async function findByTemplateId(templateId) {
  const result = await execute(
    `SELECT version_id, template_id, version_number, version_label, version_status, is_active, base_version_id, activated_at, activated_by, created_at, created_by, updated_at, updated_by
       FROM opera_cfg_template_versions
      WHERE template_id = :templateId
      ORDER BY version_number DESC`,
    { templateId: Number(templateId) }
  );
  return result.rows.map(mapVersion);
}

async function findById(versionId) {
  const result = await execute(
    `SELECT version_id, template_id, version_number, version_label, version_status, is_active, base_version_id, activated_at, activated_by, created_at, created_by, updated_at, updated_by
       FROM opera_cfg_template_versions
      WHERE version_id = :versionId`,
    { versionId: Number(versionId) }
  );
  return result.rows[0] ? mapVersion(result.rows[0]) : null;
}

async function createVersion({ templateId, versionLabel, createdBy }) {
  return executeTransaction(async (connection) => {
    const nextVersionResult = await connection.execute(
      `SELECT NVL(MAX(version_number), 0) + 1 AS next_version_number
         FROM opera_cfg_template_versions
        WHERE template_id = :templateId`,
      { templateId: Number(templateId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const nextVersionNumber = nextVersionResult.rows[0].NEXT_VERSION_NUMBER;
    const insertResult = await connection.execute(
      `INSERT INTO opera_cfg_template_versions (template_id, version_number, version_label, version_status, is_active, created_by)
       VALUES (:templateId, :versionNumber, :versionLabel, 'DRAFT', 'N', :createdBy)
       RETURNING version_id INTO :versionId`,
      {
        templateId: Number(templateId),
        versionNumber: nextVersionNumber,
        versionLabel,
        createdBy,
        versionId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    return findById(insertResult.outBinds.versionId[0]);
  });
}

async function updateVersion(versionId, { versionLabel, versionStatus, isActive, updatedBy }) {
  const result = await execute(
    `UPDATE opera_cfg_template_versions
        SET version_label = :versionLabel,
            version_status = :versionStatus,
            is_active = :isActive,
            updated_at = SYSTIMESTAMP,
            updated_by = :updatedBy
      WHERE version_id = :versionId`,
    { versionId: Number(versionId), versionLabel, versionStatus, isActive, updatedBy },
    { autoCommit: true }
  );
  if (!result.rowsAffected) return null;
  return findById(versionId);
}

async function activateVersion(versionId, activatedBy) {
  return executeTransaction(async (connection) => {
    const currentResult = await connection.execute(
      `SELECT template_id FROM opera_cfg_template_versions WHERE version_id = :versionId`,
      { versionId: Number(versionId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!currentResult.rows.length) return null;
    const templateId = currentResult.rows[0].TEMPLATE_ID;

    await connection.execute(
      `UPDATE opera_cfg_template_versions
          SET is_active = 'N',
              version_status = CASE WHEN version_status = 'ACTIVE' THEN 'INACTIVE' ELSE version_status END,
              updated_at = SYSTIMESTAMP,
              updated_by = :activatedBy
        WHERE template_id = :templateId`,
      { templateId, activatedBy }
    );

    await connection.execute(
      `UPDATE opera_cfg_template_versions
          SET is_active = 'Y',
              version_status = 'ACTIVE',
              activated_at = SYSTIMESTAMP,
              activated_by = :activatedBy,
              updated_at = SYSTIMESTAMP,
              updated_by = :activatedBy
        WHERE version_id = :versionId`,
      { versionId: Number(versionId), activatedBy }
    );

    return findById(versionId);
  });
}

module.exports = { findByTemplateId, findById, createVersion, updateVersion, activateVersion };
