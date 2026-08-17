const templateRepository = require('../repositories/templateRepository');
const { auditSafely } = require('../utils/auditHelper');
const { currentUser } = require('../utils/requestUser');

function templateName(template) {
  return template?.TEMPLATE_NAME || template?.TEMPLATE_CODE || String(template?.TEMPLATE_ID || 'template');
}

async function list(req, res, next) {
  try {
    const templates = await templateRepository.findAll();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { code, name, description } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: 'CODE_AND_NAME_REQUIRED' });

    const template = await templateRepository.createTemplate({ code, name, description: description || null, createdBy: currentUser(req) });

    await auditSafely(req, {
      username: currentUser(req),
      action: 'CREATE_TEMPLATE',
      actionCode: 'CREATE_TEMPLATE',
      resultStatus: 'SUCCESS',
      entityType: 'TEMPLATE',
      entityId: template.TEMPLATE_ID,
      entityName: templateName(template),
      summary: `Plantilla creada: ${templateName(template)}`,
      oldValues: null,
      newValues: template
    });

    res.status(201).json({ templateId: template.TEMPLATE_ID, TEMPLATE_ID: template.TEMPLATE_ID, template });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const templateId = Number(req.params.templateId || req.params.id);
    const before = await templateRepository.findById(templateId);
    if (!before) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' });

    const updated = await templateRepository.updateTemplate(templateId, {
      code: req.body.code ?? req.body.templateCode ?? req.body.TEMPLATE_CODE ?? before.TEMPLATE_CODE,
      name: req.body.name ?? req.body.templateName ?? req.body.TEMPLATE_NAME ?? before.TEMPLATE_NAME,
      description: req.body.description ?? req.body.templateDescription ?? req.body.TEMPLATE_DESCRIPTION ?? before.TEMPLATE_DESCRIPTION,
      status: req.body.status ?? req.body.STATUS ?? before.STATUS,
      updatedBy: currentUser(req)
    });

    await auditSafely(req, {
      username: currentUser(req),
      action: 'UPDATE_TEMPLATE',
      actionCode: 'UPDATE_TEMPLATE',
      resultStatus: 'SUCCESS',
      entityType: 'TEMPLATE',
      entityId: templateId,
      entityName: templateName(updated),
      summary: `Plantilla actualizada: ${templateName(updated)}`,
      oldValues: before,
      newValues: updated
    });

    res.json({ template: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create, update };
