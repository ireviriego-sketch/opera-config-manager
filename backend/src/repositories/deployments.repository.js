const { execute } = require('../db/query');
const { copyTemplateStructure, getCopiedStructure, regenerateContent, getContent } = require('./deploymentsContent.repository');
const { copyDeploymentFromSource } = require('./deploymentsCopy.repository');
const { createDeploymentRecord, updateDeploymentRecord } = require('./deploymentsWrite.repository');

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
}async function copyDeployment(chainDeploymentId, userName) {
  const source = await findById(chainDeploymentId);
  const copiedDeploymentId = await copyDeploymentFromSource(source, userName);
  if (!copiedDeploymentId) return null;
  return findById(copiedDeploymentId);
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
