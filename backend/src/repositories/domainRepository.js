const oracledb = require('oracledb');
const { execute } = require('../db/query');

async function findByVersionId(versionId) {
  const result = await execute(
    `SELECT domain_id,
            version_id,
            domain_code,
            domain_name,
            domain_description,
            display_order,
            created_at,
            created_by,
            updated_at,
            updated_by
       FROM opera_cfg_domains
      WHERE version_id = :versionId
      ORDER BY display_order, domain_name`,
    { versionId }
  );

  return result.rows;
}

async function createDomain({ versionId, code, name, description, displayOrder, createdBy }) {
  const result = await execute(
    `INSERT INTO opera_cfg_domains (
        version_id,
        domain_code,
        domain_name,
        domain_description,
        display_order,
        created_by
     ) VALUES (
        :versionId,
        :code,
        :name,
        :description,
        :displayOrder,
        :createdBy
     ) RETURNING domain_id INTO :domainId`,
    {
      versionId,
      code,
      name,
      description,
      displayOrder: displayOrder || 0,
      createdBy,
      domainId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
    { autoCommit: true }
  );

  return result.outBinds.domainId[0];
}

module.exports = { findByVersionId, createDomain };
