const deploymentsService = require('../services/deployments.service');

function currentUser(req) {
  return req.user?.email || req.user?.name || req.headers['x-user'] || null;
}

async function listDeployments(req, res) {
  const rows = await deploymentsService.listDeployments(req.query || {});
  res.json({ ok: true, rows });
}

async function getDeployment(req, res) {
  const deployment = await deploymentsService.getDeployment(req.params.deploymentId);
  if (!deployment) return res.status(404).json({ ok: false, error: 'Deployment not found' });
  res.json({ ok: true, deployment });
}

async function listTemplateVersions(_req, res) {
  const rows = await deploymentsService.listTemplateVersions();
  res.json({ ok: true, rows });
}

async function createDeployment(req, res) {
  const deployment = await deploymentsService.createDeployment(req.params.chainId, req.body, currentUser(req));
  res.status(201).json({ ok: true, deployment });
}

async function updateDeployment(req, res) {
  const deployment = await deploymentsService.updateDeployment(req.params.deploymentId, req.body, currentUser(req));
  if (!deployment) return res.status(404).json({ ok: false, error: 'Deployment not found' });
  res.json({ ok: true, deployment });
}

async function copyDeployment(req, res) {
  const deployment = await deploymentsService.copyDeployment(req.params.deploymentId, currentUser(req));
  if (!deployment) return res.status(404).json({ ok: false, error: 'Deployment not found' });
  res.status(201).json({ ok: true, deployment });
}

async function getContent(req, res) {
  const content = await deploymentsService.getContent(req.params.deploymentId);
  if (!content) return res.status(404).json({ ok: false, error: 'Deployment content not found' });
  res.json({ ok: true, content });
}

module.exports = { listDeployments, getDeployment, listTemplateVersions, createDeployment, updateDeployment, copyDeployment, getContent };
