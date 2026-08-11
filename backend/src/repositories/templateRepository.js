const { execute } = require('../db/query');

async function findAll() {
  const result = await execute(
    `SELECT template_id, template_code, template_name, template_description, status, created_at, updated_at
       FROM opera_cfg_templates
      ORDER BY template_name`
  );
  return result.rows;
}

async function createTemplate({ code, name, description, createdBy }) {
  const result = await execute(
    `INSERT INTO opera_cfg_templates (template_code, template_name, template_description, created_by)
     VALUES (:code, :name, :description, :createdBy)
     RETURNING template_id INTO :templateId`,
    {
      code,
      name,
      description,
      createdBy,
      templateId: { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER }
    },
    { autoCommit: true }
  );
  return result.outBinds.templateId[0];
}

module.exports = { findAll, createTemplate };
