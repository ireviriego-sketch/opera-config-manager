const oracledb = require('oracledb');
const { execute } = require('../db/query');

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

async function getDeploymentForContent(chainDeploymentId) {
  const result = await execute(
    `SELECT d.chain_deployment_id,
            d.chain_id,
            d.deployment_name,
            d.status,
            d.source_template_version_id,
            d.comments
       FROM opera_cfg_chain_deployments d
      WHERE d.chain_deployment_id = :chainDeploymentId`,
    { chainDeploymentId: Number(chainDeploymentId) }
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    chainDeploymentId: row.CHAIN_DEPLOYMENT_ID,
    deploymentName: row.DEPLOYMENT_NAME,
    status: row.STATUS,
    sourceTemplateVersionId: row.SOURCE_TEMPLATE_VERSION_ID,
    comments: row.COMMENTS,
    chainId: row.CHAIN_ID
  };
}

async function getChainForContent(chainId) {
  const result = await execute(
    `SELECT chain_id, chain_code, chain_name, status
       FROM opera_cfg_chains
      WHERE chain_id = :chainId`,
    { chainId: Number(chainId) }
  );

  return result.rows[0] || null;
}

async function getHotelsForContent(chainId) {
  const result = await execute(
    `SELECT hotel_id, hotel_code, hotel_name, status
       FROM opera_cfg_hotels
      WHERE chain_id = :chainId
      ORDER BY UPPER(hotel_name)`,
    { chainId: Number(chainId) }
  );

  return result.rows;
}

async function cleanupCopiedStructure(chainDeploymentId) {
  await execute(
    `DELETE /*+ NO_PARALLEL */ FROM opera_cfg_chain_deployment_records
      WHERE chain_deployment_id = :id`,
    { id: Number(chainDeploymentId) },
    { autoCommit: true }
  );
  await execute(
    `DELETE /*+ NO_PARALLEL */ FROM opera_cfg_chain_deployment_attributes
      WHERE chain_deployment_id = :id`,
    { id: Number(chainDeploymentId) },
    { autoCommit: true }
  );
  await execute(
    `DELETE /*+ NO_PARALLEL */ FROM opera_cfg_chain_deployment_entities
      WHERE chain_deployment_id = :id`,
    { id: Number(chainDeploymentId) },
    { autoCommit: true }
  );
  await execute(
    `DELETE /*+ NO_PARALLEL */ FROM opera_cfg_chain_deployment_domains
      WHERE chain_deployment_id = :id`,
    { id: Number(chainDeploymentId) },
    { autoCommit: true }
  );
}

async function copyTemplateStructure(chainDeploymentId, sourceTemplateVersionId, userName) {
  if (!sourceTemplateVersionId) {
    await cleanupCopiedStructure(chainDeploymentId);
    return { domains: 0, entities: 0, attributes: 0, note: 'No source template version selected.' };
  }

  await cleanupCopiedStructure(chainDeploymentId);

  const versionId = Number(sourceTemplateVersionId);
  const summary = { domains: 0, entities: 0, attributes: 0 };
  const domainIdMap = new Map();
  const entityIdMap = new Map();

  const domainResult = await execute(
    `SELECT domain_id,
            version_id,
            domain_code,
            domain_name,
            domain_description,
            display_order
       FROM opera_cfg_domains
      WHERE version_id = :versionId
      ORDER BY display_order, domain_id`,
    { versionId }
  );

  for (const row of domainResult.rows) {
    const insertResult = await execute(
      `INSERT INTO opera_cfg_chain_deployment_domains
         (chain_deployment_id, source_domain_id, domain_code, domain_name, status, sort_order, created_by)
       VALUES
         (:chainDeploymentId, :sourceDomainId, :domainCode, :domainName, 'ACTIVE', :sortOrder, :createdBy)
       RETURNING deployment_domain_id INTO :deploymentDomainId`,
      {
        chainDeploymentId: Number(chainDeploymentId),
        sourceDomainId: row.DOMAIN_ID,
        domainCode: row.DOMAIN_CODE,
        domainName: row.DOMAIN_NAME,
        sortOrder: row.DISPLAY_ORDER,
        createdBy: userName || null,
        deploymentDomainId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    domainIdMap.set(Number(row.DOMAIN_ID), insertResult.outBinds.deploymentDomainId[0]);
    summary.domains += 1;
  }

  if (!domainIdMap.size) return summary;

  const domainIdList = Array.from(domainIdMap.keys());
  const domainBindNames = domainIdList.map((_, index) => `:domain${index}`);
  const domainBinds = Object.fromEntries(domainIdList.map((id, index) => [`domain${index}`, id]));

  const entityResult = await execute(
    `SELECT de.domain_id,
            de.entity_id,
            de.display_order AS domain_entity_display_order,
            e.entity_code,
            e.entity_name,
            e.entity_description,
            e.default_collapsed,
            e.display_order AS entity_display_order
       FROM opera_cfg_domain_entities de
       JOIN opera_cfg_entities e
         ON e.entity_id = de.entity_id
      WHERE de.domain_id IN (${domainBindNames.join(',')})
        AND e.version_id = :versionId
        AND NVL(e.is_active, 'Y') = 'Y'
      ORDER BY de.domain_id, de.display_order, e.display_order, e.entity_id`,
    { ...domainBinds, versionId }
  );

  for (const row of entityResult.rows) {
    const deploymentDomainId = domainIdMap.get(Number(row.DOMAIN_ID));
    if (!deploymentDomainId) continue;

    const insertResult = await execute(
      `INSERT INTO opera_cfg_chain_deployment_entities
         (chain_deployment_id, deployment_domain_id, source_entity_id, entity_code, entity_name, status, sort_order, created_by)
       VALUES
         (:chainDeploymentId, :deploymentDomainId, :sourceEntityId, :entityCode, :entityName, 'ACTIVE', :sortOrder, :createdBy)
       RETURNING deployment_entity_id INTO :deploymentEntityId`,
      {
        chainDeploymentId: Number(chainDeploymentId),
        deploymentDomainId,
        sourceEntityId: row.ENTITY_ID,
        entityCode: row.ENTITY_CODE,
        entityName: row.ENTITY_NAME,
        sortOrder: row.DOMAIN_ENTITY_DISPLAY_ORDER || row.ENTITY_DISPLAY_ORDER,
        createdBy: userName || null,
        deploymentEntityId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    entityIdMap.set(Number(row.ENTITY_ID), insertResult.outBinds.deploymentEntityId[0]);
    summary.entities += 1;
  }

  if (!entityIdMap.size) return summary;

  const entityIdList = Array.from(entityIdMap.keys());
  const entityBindNames = entityIdList.map((_, index) => `:entity${index}`);
  const entityBinds = Object.fromEntries(entityIdList.map((id, index) => [`entity${index}`, id]));

  const attributeResult = await execute(
    `SELECT attribute_id,
            entity_id,
            attribute_code,
            attribute_name,
            attribute_description,
            data_type_id,
            is_required,
            default_value,
            lov_code,
            display_order
       FROM opera_cfg_attributes
      WHERE entity_id IN (${entityBindNames.join(',')})
        AND NVL(is_active, 'Y') = 'Y'
      ORDER BY entity_id, display_order, attribute_id`,
    entityBinds
  );

  for (const row of attributeResult.rows) {
    const deploymentEntityId = entityIdMap.get(Number(row.ENTITY_ID));
    if (!deploymentEntityId) continue;

    await execute(
      `INSERT INTO opera_cfg_chain_deployment_attributes
         (chain_deployment_id, deployment_entity_id, source_attribute_id, attribute_code, attribute_name, data_type, is_required, default_value, status, sort_order, created_by)
       VALUES
         (:chainDeploymentId, :deploymentEntityId, :sourceAttributeId, :attributeCode, :attributeName, :dataType, :isRequired, :defaultValue, 'ACTIVE', :sortOrder, :createdBy)`,
      {
        chainDeploymentId: Number(chainDeploymentId),
        deploymentEntityId,
        sourceAttributeId: row.ATTRIBUTE_ID,
        attributeCode: row.ATTRIBUTE_CODE,
        attributeName: row.ATTRIBUTE_NAME,
        dataType: row.DATA_TYPE_ID ? String(row.DATA_TYPE_ID) : null,
        isRequired: row.IS_REQUIRED,
        defaultValue: row.DEFAULT_VALUE,
        sortOrder: row.DISPLAY_ORDER,
        createdBy: userName || null
      },
      { autoCommit: true }
    );

    summary.attributes += 1;
  }

  return summary;
}

async function getCopiedStructure(chainDeploymentId) {
  const domainsResult = await execute(
    `SELECT deployment_domain_id, source_domain_id, domain_code, domain_name, status, sort_order
       FROM opera_cfg_chain_deployment_domains
      WHERE chain_deployment_id = :id
      ORDER BY NVL(sort_order, deployment_domain_id)`,
    { id: Number(chainDeploymentId) }
  );

  const entitiesResult = await execute(
    `SELECT deployment_entity_id, deployment_domain_id, source_entity_id, entity_code, entity_name, status, sort_order
       FROM opera_cfg_chain_deployment_entities
      WHERE chain_deployment_id = :id
      ORDER BY deployment_domain_id, NVL(sort_order, deployment_entity_id)`,
    { id: Number(chainDeploymentId) }
  );

  const attributesResult = await execute(
    `SELECT deployment_attribute_id, deployment_entity_id, source_attribute_id, attribute_code, attribute_name, data_type, is_required, default_value, status, sort_order
       FROM opera_cfg_chain_deployment_attributes
      WHERE chain_deployment_id = :id
      ORDER BY deployment_entity_id, NVL(sort_order, deployment_attribute_id)`,
    { id: Number(chainDeploymentId) }
  );

  const attributesByEntity = new Map();
  attributesResult.rows.forEach(row => {
    const key = Number(row.DEPLOYMENT_ENTITY_ID);
    if (!attributesByEntity.has(key)) attributesByEntity.set(key, []);
    attributesByEntity.get(key).push({
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
  entitiesResult.rows.forEach(row => {
    const key = Number(row.DEPLOYMENT_DOMAIN_ID || 0);
    if (!entitiesByDomain.has(key)) entitiesByDomain.set(key, []);
    entitiesByDomain.get(key).push({
      deploymentEntityId: row.DEPLOYMENT_ENTITY_ID,
      sourceEntityId: row.SOURCE_ENTITY_ID,
      entityCode: row.ENTITY_CODE,
      entityName: row.ENTITY_NAME,
      status: row.STATUS,
      attributes: attributesByEntity.get(Number(row.DEPLOYMENT_ENTITY_ID)) || []
    });
  });

  return domainsResult.rows.map(row => ({
    deploymentDomainId: row.DEPLOYMENT_DOMAIN_ID,
    sourceDomainId: row.SOURCE_DOMAIN_ID,
    domainCode: row.DOMAIN_CODE,
    domainName: row.DOMAIN_NAME,
    status: row.STATUS,
    entities: entitiesByDomain.get(Number(row.DEPLOYMENT_DOMAIN_ID)) || []
  }));
}

async function buildDeploymentJson(chainDeploymentId) {
  const deployment = await getDeploymentForContent(chainDeploymentId);
  if (!deployment) return null;

  const chain = await getChainForContent(deployment.chainId);
  const hotels = await getHotelsForContent(deployment.chainId);
  const templateStructure = await getCopiedStructure(chainDeploymentId);

  return {
    schemaVersion: '2.1',
    generatedAt: new Date().toISOString(),
    deployment: {
      chainDeploymentId: deployment.chainDeploymentId,
      deploymentName: deployment.deploymentName,
      status: deployment.status,
      sourceTemplateVersionId: deployment.sourceTemplateVersionId,
      comments: deployment.comments
    },
    chain: chain ? {
      chainId: chain.CHAIN_ID,
      chainCode: chain.CHAIN_CODE,
      chainName: chain.CHAIN_NAME,
      status: chain.STATUS
    } : null,
    hotels: hotels.map(hotel => ({
      hotelId: hotel.HOTEL_ID,
      hotelCode: hotel.HOTEL_CODE,
      hotelName: hotel.HOTEL_NAME,
      status: hotel.STATUS
    })),
    templateStructure
  };
}

async function upsertContent(connection, chainDeploymentId, contentJson, userName) {
  const jsonText = JSON.stringify(contentJson, null, 2);
  const existing = await connection.execute(
    `SELECT content_id
       FROM opera_cfg_chain_deployment_content
      WHERE chain_deployment_id = :chainDeploymentId
        AND content_type = 'EXPORT_JSON'`,
    { chainDeploymentId: Number(chainDeploymentId) }
  );

  if (existing.rows.length) {
    await connection.execute(
      `UPDATE opera_cfg_chain_deployment_content
          SET content_json = :contentJson,
              updated_at = SYSTIMESTAMP,
              updated_by = :updatedBy
        WHERE chain_deployment_id = :chainDeploymentId
          AND content_type = 'EXPORT_JSON'`,
      { chainDeploymentId: Number(chainDeploymentId), contentJson: jsonText, updatedBy: userName || null }
    );
  } else {
    await connection.execute(
      `INSERT INTO opera_cfg_chain_deployment_content
         (chain_deployment_id, content_type, content_json, created_by)
       VALUES
         (:chainDeploymentId, 'EXPORT_JSON', :contentJson, :createdBy)`,
      { chainDeploymentId: Number(chainDeploymentId), contentJson: jsonText, createdBy: userName || null }
    );
  }
}

async function regenerateContent(connection, chainDeploymentId, userName) {
  const contentJson = await buildDeploymentJson(chainDeploymentId);
  await upsertContent(connection, chainDeploymentId, contentJson, userName);
  return contentJson;
}

async function getContent(chainDeploymentId) {
  let result = await execute(
    `SELECT content_json
       FROM opera_cfg_chain_deployment_content
      WHERE chain_deployment_id = :chainDeploymentId
        AND content_type = 'EXPORT_JSON'
      ORDER BY content_id DESC`,
    { chainDeploymentId: Number(chainDeploymentId) }
  );

  if (!result.rows.length) {
    const contentJson = await buildDeploymentJson(chainDeploymentId);
    if (!contentJson) return null;
    await execute(
      `INSERT INTO opera_cfg_chain_deployment_content
         (chain_deployment_id, content_type, content_json)
       VALUES
         (:chainDeploymentId, 'EXPORT_JSON', :contentJson)`,
      { chainDeploymentId: Number(chainDeploymentId), contentJson: JSON.stringify(contentJson, null, 2) },
      { autoCommit: true }
    );
    result = await execute(
      `SELECT content_json
         FROM opera_cfg_chain_deployment_content
        WHERE chain_deployment_id = :chainDeploymentId
          AND content_type = 'EXPORT_JSON'
        ORDER BY content_id DESC`,
      { chainDeploymentId: Number(chainDeploymentId) }
    );
  }

  const parsedContent = await parseJsonClob(result.rows[0].CONTENT_JSON);
  return parsedContent;
}

module.exports = {
  copyTemplateStructure,
  getCopiedStructure,
  regenerateContent,
  getContent
};
