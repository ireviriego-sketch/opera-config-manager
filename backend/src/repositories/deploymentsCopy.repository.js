const oracledb = require('oracledb');
const { executeTransaction } = require('../db/query');
const { copyTemplateStructure, regenerateContent } = require('./deploymentsContent.repository');

async function copyDeploymentFromSource(source, userName) {
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
  });
}

module.exports = {
  copyDeploymentFromSource
};
