const deploymentsRepository = require('../repositories/deployments.repository');
const { validateCreatePayload, validateUpdatePayload } = require('../utils/deployments.validators');

async function listDeployments(filters = {}) {
  return deploymentsRepository.findAll(filters);
}

async function getDeployment(deploymentId) {
  return deploymentsRepository.findById(deploymentId);
}

async function listTemplateVersions() {
  return deploymentsRepository.listTemplateVersions();
}

async function createDeployment(chainId, body, userName) {
  const payload = validateCreatePayload(body);
  return deploymentsRepository.createDeployment(chainId, payload, userName || null);
}

async function updateDeployment(deploymentId, body, userName) {
  const payload = validateUpdatePayload(body);
  return deploymentsRepository.updateDeployment(deploymentId, payload, userName || null);
}

async function copyDeployment(deploymentId, userName) {
  return deploymentsRepository.copyDeployment(deploymentId, userName || null);
}

async function getContent(deploymentId) {
  return deploymentsRepository.getContent(deploymentId);
}

module.exports = { listDeployments, getDeployment, listTemplateVersions, createDeployment, updateDeployment, copyDeployment, getContent };
