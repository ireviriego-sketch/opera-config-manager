const oracledb = require('oracledb');
const { execute } = require('../db/query');

function mapTemplate(row) {
  return {
    TEMPLATE_ID: row.TEMPLATE_ID,
    TEMPLATE_CODE: row.TEMPLATE_CODE,
    TEMPLATE_NAME: row.TEMPLATE_NAME,
    TEMPLATE_DESCRIPTION: row.TEMPLATE_DESCRIPTION,
    STATUS: row.STATUS,
    CREATED_AT: row.CREATED_AT,
    CREATED_BY: row.CREATED_BY,
    UPDATED_AT: row.UPDATED_AT,
    UPDATED_BY: row.UPDATED_BY,
    templateId: row.TEMPLATE_ID,
    templateCode: row.TEMPLATE_CODE,
    templateName: row.TEMPLATE_NAME,
    templateDescription: row.TEMPLATE_DESCRIPTION,
    status: row.STATUS
  };
}

async function findAll() {
  const result = await execute(
    `SELECT template_id, template_code, template_name, template_description, status, created_at, created_by, updated_at, updated_by
       FROM opera_cfg_templates
      ORDER BY UPPER(template_name)`
  );
  return result.rows.map(mapTemplate);
}

async function findById(templateId) {
  const result = await execute(
    `SELECT template_id, template_code, template_name, template_description, status, created_at, created_by, updated_at, updated_by
       FROM opera_cfg_templates
      WHERE template_id = :templateId`,
    { templateId: Number(templateId) }
  );
  return result.rows[0] ? mapTemplate(result.rows[0]) : null;
}

async function createTemplate({ code, name, description, createdBy }) {
  const result = await execute(
    `INSERT INTO opera_cfg_templates (template_code, template_name, template_description, status, created_by)
     VALUES (:code, :name, :description, 'ACTIVE', :createdBy)
     RETURNING template_id INTO :templateId`,
    {
      code,
      name,
      description,
      createdBy,
      templateId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
    { autoCommit: true }
  );
  return findById(result.outBinds.templateId[0]);
}

async function updateTemplate(templateId, { code, name, description, status, updatedBy }) {
  const result = await execute(
    `UPDATE opera_cfg_templates
        SET template_code = :code,
            template_name = :name,
            template_description = :description,
            status = :status,
            updated_at = SYSTIMESTAMP,
            updated_by = :updatedBy
      WHERE template_id = :templateId`,
    { templateId: Number(templateId), code, name, description, status, updatedBy },
    { autoCommit: true }
  );
  if (!result.rowsAffected) return null;
  return findById(templateId);
}

module.exports = { findAll, findById, createTemplate, updateTemplate };
