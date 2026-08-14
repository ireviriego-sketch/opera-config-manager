const templateVersionRepository = require('../repositories/templateVersionRepository');
const templateRepository = require('../repositories/templateRepository');
const auditService = require('../services/audit.service');

function currentUser(req) {
  return req.user?.username || req.user?.USERNAME || req.headers['x-user'] || req.headers['x-username'] || 'system';
}

async function auditSafely(req, entry) {
  try {
    await auditService.logFromRequest(req, entry);
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
}

function versionName(version, template) {
  const templateName = template?.TEMPLATE_NAME || `Template ${version?.TEMPLATE_ID || ''}`;
  const number = version?.VERSION_NUMBER;
  const label = version?.VERSION_LABEL;
  return `${templateName} v${number || ''}${label ? ` - ${label}` : ''}`.trim();
}

async function listByTemplate(req, res, next) {
  try {
    const templateId = Number(req.query.templateId);
    if (!templateId) return res.status(400).json({ error: 'TEMPLATE_ID_REQUIRED' });

    const versions = await templateVersionRepository.findByTemplateId(templateId);
    res.json({ versions });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const templateId = Number(req.body?.templateId ?? req.body?.TEMPLATE_ID);
    const versionLabel = req.body?.versionLabel ?? req.body?.VERSION_LABEL ?? null;

    if (!templateId) return res.status(400).json({ error: 'TEMPLATE_ID_REQUIRED' });

    const version = await templateVersionRepository.createVersion({
      templateId,
      versionLabel,
      createdBy: currentUser(req)
    });

    if (!version) return res.status(500).json({ error: 'VERSION_CREATE_FAILED' });

    const template = await templateRepository.findById(templateId);

    await auditSafely(req, {
      username: currentUser(req),
      action: 'CREATE_VERSION',
      actionCode: 'CREATE_VERSION',
      resultStatus: 'SUCCESS',
      entityType: 'TEMPLATE_VERSION',
      entityId: version.VERSION_ID,
      entityName: versionName(version, template),
      summary: `Versión de plantilla creada: ${versionName(version, template)}`,
      oldValues: null,
      newValues: version,
      details: { template }
    });

    res.status(201).json({
      versionId: version.VERSION_ID,
      versionNumber: version.VERSION_NUMBER,
      VERSION_ID: version.VERSION_ID,
      VERSION_NUMBER: version.VERSION_NUMBER,
      version
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const versionId = Number(req.params.versionId || req.params.id);
    const before = await templateVersionRepository.findById(versionId);
    if (!before) return res.status(404).json({ error: 'VERSION_NOT_FOUND' });

    const updated = await templateVersionRepository.updateVersion(versionId, {
      versionLabel: req.body.versionLabel ?? req.body.VERSION_LABEL ?? before.VERSION_LABEL,
      versionStatus: req.body.versionStatus ?? req.body.VERSION_STATUS ?? before.VERSION_STATUS,
      isActive: req.body.isActive ?? req.body.IS_ACTIVE ?? before.IS_ACTIVE,
      updatedBy: currentUser(req)
    });

    const template = await templateRepository.findById(updated.TEMPLATE_ID);

    await auditSafely(req, {
      username: currentUser(req),
      action: 'UPDATE_VERSION',
      actionCode: 'UPDATE_VERSION',
      resultStatus: 'SUCCESS',
      entityType: 'TEMPLATE_VERSION',
      entityId: versionId,
      entityName: versionName(updated, template),
      summary: `Versión de plantilla actualizada: ${versionName(updated, template)}`,
      oldValues: before,
      newValues: updated,
      details: { template }
    });

    res.json({ version: updated });
  } catch (error) {
    next(error);
  }
}

async function activate(req, res, next) {
  try {
    const versionId = Number(req.params.versionId || req.params.id);
    const before = await templateVersionRepository.findById(versionId);
    if (!before) return res.status(404).json({ error: 'VERSION_NOT_FOUND' });

    const after = await templateVersionRepository.activateVersion(versionId, currentUser(req));
    if (!after) return res.status(404).json({ error: 'VERSION_NOT_FOUND' });

    const template = await templateRepository.findById(after.TEMPLATE_ID);

    await auditSafely(req, {
      username: currentUser(req),
      action: 'ACTIVATE_VERSION',
      actionCode: 'ACTIVATE_VERSION',
      resultStatus: 'SUCCESS',
      entityType: 'TEMPLATE_VERSION',
      entityId: versionId,
      entityName: versionName(after, template),
      summary: `Versión de plantilla activada: ${versionName(after, template)}`,
      oldValues: before,
      newValues: after,
      details: { template }
    });

    res.json({ version: after });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listByTemplate,
  create,
  update,
  activate
};
