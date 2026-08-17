const oracledb = require('oracledb');
const { executeTransaction } = require('../db/query');
const { copyTemplateStructure, regenerateContent } = require('./deploymentsContent.repository');

async function createDeploymentRecord(chainId, payload, userName) {
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

  return chainDeploymentId;
}

async function updateDeploymentRecord(chainDeploymentId, payload, userName) {
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

  return chainDeploymentId;
}

module.exports = {
  createDeploymentRecord,
  updateDeploymentRecord
};
