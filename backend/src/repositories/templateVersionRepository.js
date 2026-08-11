const oracledb = require('oracledb');
const { execute, executeTransaction } = require('../db/query');

async function findByTemplateId(templateId) {
  const result = await execute(
    `SELECT version_id,
            template_id,
            version_number,
            version_label,
            version_status,
            is_active,
            base_version_id,
            activated_at,
            activated_by,
            created_at,
            created_by,
            updated_at,
            updated_by
       FROM opera_cfg_template_versions
      WHERE template_id = :templateId
      ORDER BY version_number DESC`,
    { templateId }
  );

  return result.rows;
}

async function createVersion({ templateId, versionLabel, createdBy }) {
  return executeTransaction(async (connection) => {
    const nextVersionResult = await connection.execute(
      `SELECT NVL(MAX(version_number), 0) + 1 AS next_version_number
         FROM opera_cfg_template_versions
        WHERE template_id = :templateId`,
      { templateId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const nextVersionNumber = nextVersionResult.rows[0].NEXT_VERSION_NUMBER;

    const insertResult = await connection.execute(
      `INSERT INTO opera_cfg_template_versions (
          template_id,
          version_number,
          version_label,
          version_status,
          is_active,
          created_by
       ) VALUES (
          :templateId,
          :versionNumber,
          :versionLabel,
          'DRAFT',
          'N',
          :createdBy
       ) RETURNING version_id INTO :versionId`,
      {
        templateId,
        versionNumber: nextVersionNumber,
        versionLabel,
        createdBy,
        versionId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    return {
      versionId: insertResult.outBinds.versionId[0],
      versionNumber: nextVersionNumber
    };
  });
}

module.exports = { findByTemplateId, createVersion };
