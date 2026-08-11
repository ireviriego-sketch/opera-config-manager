const oracledb = require('oracledb');
const { execute, executeTransaction } = require('../db/query');

async function findByDomainId(domainId) {
  const result = await execute(
    `SELECT e.entity_id,
            e.version_id,
            e.entity_code,
            e.entity_name,
            e.entity_description,
            e.source_section_name,
            e.default_collapsed,
            e.display_order,
            e.is_active,
            e.created_at,
            e.created_by,
            de.domain_entity_id,
            de.domain_id
       FROM opera_cfg_domain_entities de
       JOIN opera_cfg_entities e ON e.entity_id = de.entity_id
      WHERE de.domain_id = :domainId
      ORDER BY de.display_order, e.display_order, e.entity_name`,
    { domainId }
  );

  return result.rows;
}

async function createEntity({ domainId, code, name, description, sourceSectionName, displayOrder, createdBy }) {
  return executeTransaction(async (connection) => {
    const domainResult = await connection.execute(
      `SELECT domain_id, version_id
         FROM opera_cfg_domains
        WHERE domain_id = :domainId`,
      { domainId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!domainResult.rows.length) {
      const error = new Error('Domain not found');
      error.statusCode = 404;
      error.code = 'DOMAIN_NOT_FOUND';
      throw error;
    }

    const versionId = domainResult.rows[0].VERSION_ID;

    const entityResult = await connection.execute(
      `INSERT INTO opera_cfg_entities (
          version_id,
          entity_code,
          entity_name,
          entity_description,
          source_section_name,
          default_collapsed,
          display_order,
          is_active,
          created_by
       ) VALUES (
          :versionId,
          :code,
          :name,
          :description,
          :sourceSectionName,
          'Y',
          :displayOrder,
          'Y',
          :createdBy
       ) RETURNING entity_id INTO :entityId`,
      {
        versionId,
        code,
        name,
        description,
        sourceSectionName,
        displayOrder: displayOrder || 0,
        createdBy,
        entityId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    const entityId = entityResult.outBinds.entityId[0];

    await connection.execute(
      `INSERT INTO opera_cfg_domain_entities (
          domain_id,
          entity_id,
          display_order,
          created_by
       ) VALUES (
          :domainId,
          :entityId,
          :displayOrder,
          :createdBy
       )`,
      {
        domainId,
        entityId,
        displayOrder: displayOrder || 0,
        createdBy
      }
    );

    return entityId;
  });
}

module.exports = { findByDomainId, createEntity };
