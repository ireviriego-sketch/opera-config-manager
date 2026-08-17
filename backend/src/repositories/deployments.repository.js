const oracledb = require('oracledb');
const { execute, executeTransaction } = require('../db/query');
const { copyTemplateStructure, getCopiedStructure, regenerateContent, getContent } = require('./deploymentsContent.repository');

function mapDeployment(row) {
  return {
    deploymentId: row.CHAIN_DEPLOYMENT_ID,
    chainDeploymentId: row.CHAIN_DEPLOYMENT_ID,
    chainId: row.CHAIN_ID,
    chainCode: row.CHAIN_CODE,
    chainName: row.CHAIN_NAME,
    deploymentName: row.DEPLOYMENT_NAME,
    status: row.STATUS,
    sourceTemplateVersionId: row.SOURCE_TEMPLATE_VERSION_ID,
    createdAt: row.CREATED_AT,
    createdBy: row.CREATED_BY,
    updatedAt: row.UPDATED_AT,
    updatedBy: row.UPDATED_BY,
    sentAt: row.SENT_AT,
    sentBy: row.SENT_BY,
    comments: row.COMMENTS,
    locked: row.STATUS === 'SENT_OK'
  };
}

function mapTemplateVersion(row) {
  return {
    templateVersionId: row.VERSION_ID,
    templateId: row.TEMPLATE_ID,
    label: row.VERSION_LABEL || `Version ${row.VERSION_NUMBER || row.VERSION_ID}`,
    status: row.VERSION_STATUS
  };
}
async function findAll(filters = {}) {
  const chainId = filters.chainId ? Number(filters.chainId) : null;
  const search = String(filters.search || '').trim().toUpperCase();
  const binds = {};
  let where = '1 = 1';

  if (chainId) {
    binds.chainId = chainId;
    where += ' AND d.chain_id = :chainId';
  }

  if (search) {
    binds.search = `%${search}%`;
    where += ` AND (
      UPPER(d.deployment_name) LIKE :search
      OR UPPER(d.status) LIKE :search
      OR UPPER(c.chain_code) LIKE :search
      OR UPPER(c.chain_name) LIKE :search
    )`;
  }

  const result = await execute(
    `SELECT d.chain_deployment_id,
            d.chain_id,
            c.chain_code,
            c.chain_name,
            d.deployment_name,
            d.status,
            d.source_template_version_id,
            d.created_at,
            d.created_by,
            d.updated_at,
            d.updated_by,
            d.sent_at,
            d.sent_by,
            d.comments
       FROM opera_cfg_chain_deployments d
       JOIN opera_cfg_chains c
         ON c.chain_id = d.chain_id
      WHERE ${where}
      ORDER BY d.created_at DESC, d.chain_deployment_id DESC`,
    binds
  );

  return result.rows.map(mapDeployment);
}

async function findById(chainDeploymentId) {
  const result = await execute(
    `SELECT d.chain_deployment_id,
            d.chain_id,
            c.chain_code,
            c.chain_name,
            d.deployment_name,
            d.status,
            d.source_template_version_id,
            d.created_at,
            d.created_by,
            d.updated_at,
            d.updated_by,
            d.sent_at,
            d.sent_by,
            d.comments
       FROM opera_cfg_chain_deployments d
       JOIN opera_cfg_chains c
         ON c.chain_id = d.chain_id
      WHERE d.chain_deployment_id = :chainDeploymentId`,
    { chainDeploymentId: Number(chainDeploymentId) }
  );
  return result.rows[0] ? mapDeployment(result.rows[0]) : null;
}

async function listTemplateVersions() {
  const result = await execute(
    `SELECT version_id,
            template_id,
            version_number,
            version_label,
            version_status
       FROM opera_cfg_template_versions
      ORDER BY version_id DESC`
  );
  return result.rows.map(mapTemplateVersion);
}

async function getChain(chainId) {
  const result = await execute(
    `SELECT chain_id, chain_code, chain_name, status
       FROM opera_cfg_chains
      WHERE chain_id = :chainId`,
    { chainId: Number(chainId) }
  );
  return result.rows[0] || null;
}

async function getHotels(chainId) {
  const result = await execute(
    `SELECT hotel_id, hotel_code, hotel_name, status
       FROM opera_cfg_hotels
      WHERE chain_id = :chainId
      ORDER BY UPPER(hotel_name)`,
    { chainId: Number(chainId) }
  );
  return result.rows;
}async function createDeployment(chainId, payload, userName) {
  // Paso 1: crear el registro del despliegue
  const chainDeploymentId = await executeTransaction(async connection => {
    const result = await connection.execute(
      `INSERT INTO opera_cfg_chain_deployments
         (chain_id, deployment_name, status, source_template_version_id, comments, created_by)
       VALUES
         (:chainId, :deploymentName, 'DRAFT', :sourceTemplateVersionId, :comments, :createdBy)
       RETURNING chain_deployment_id INTO :chainDeploymentId`,
      {
        chainId: Number(chainId),
        deploymentName: payload.deploymentName,
        sourceTemplateVersionId: payload.sourceTemplateVersionId || null,
        comments: payload.comments || null,
        createdBy: userName || null,
        chainDeploymentId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    return result.outBinds.chainDeploymentId[0];
  });

  // Paso 2: copiar estructura con commits por operación
  await copyTemplateStructure(chainDeploymentId, payload.sourceTemplateVersionId, userName);

  // Paso 3: regenerar contenido
  await executeTransaction(async connection => {
    await regenerateContent(connection, chainDeploymentId, userName);
  });

  return findById(chainDeploymentId);
}

async function updateDeployment(chainDeploymentId, payload, userName) {
  const current = await findById(chainDeploymentId);
  if (!current) return null;
  if (current.locked) {
    const error = new Error('Deployment is locked because it was sent successfully');
    error.statusCode = 409;
    throw error;
  }

  // Paso 1: actualizar el registro
  await executeTransaction(async connection => {
    await connection.execute(
      `UPDATE opera_cfg_chain_deployments
          SET deployment_name = :deploymentName,
              status = :status,
              source_template_version_id = :sourceTemplateVersionId,
              comments = :comments,
              updated_at = SYSTIMESTAMP,
              updated_by = :updatedBy
        WHERE chain_deployment_id = :chainDeploymentId`,
      {
        chainDeploymentId: Number(chainDeploymentId),
        deploymentName: payload.deploymentName,
        status: payload.status,
        sourceTemplateVersionId: payload.sourceTemplateVersionId || null,
        comments: payload.comments || null,
        updatedBy: userName || null
      }
    );
  });

  // Paso 2: copiar estructura con commits por operación
  await copyTemplateStructure(chainDeploymentId, payload.sourceTemplateVersionId, userName);

  // Paso 3: regenerar contenido
  await executeTransaction(async connection => {
    await regenerateContent(connection, chainDeploymentId, userName);
  });

  return findById(chainDeploymentId);
}

async function copyDeployment(chainDeploymentId, userName) {
  const source = await findById(chainDeploymentId);
  if (!source) return null;

  return executeTransaction(async connection => {
    const result = await connection.execute(
      `INSERT INTO opera_cfg_chain_deployments
         (chain_id, deployment_name, status, source_template_version_id, comments, created_by)
       VALUES
         (:chainId, :deploymentName, 'DRAFT', :sourceTemplateVersionId, :comments, :createdBy)
       RETURNING chain_deployment_id INTO :newChainDeploymentId`,
      {
        chainId: Number(source.chainId),
        deploymentName: `${source.deploymentName} - copia editable`,
        sourceTemplateVersionId: source.sourceTemplateVersionId || null,
        comments: source.comments || null,
        createdBy: userName || null,
        newChainDeploymentId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    const newChainDeploymentId = result.outBinds.newChainDeploymentId[0];
    await copyTemplateStructure(newChainDeploymentId, source.sourceTemplateVersionId, userName);
    await regenerateContent(connection, newChainDeploymentId, userName);
    return newChainDeploymentId;
  }).then(findById);
}
module.exports = {
  findAll,
  findById,
  listTemplateVersions,
  createDeployment,
  updateDeployment,
  copyDeployment,
  getContent,
  getCopiedStructure,
  copyTemplateStructure
};
