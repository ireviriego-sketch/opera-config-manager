const templateVersionRepository = require('../repositories/templateVersionRepository');

async function listByTemplate(req, res, next) {
  try {
    const templateId = Number(req.query.templateId);

    if (!templateId) {
      return res.status(400).json({ error: 'TEMPLATE_ID_REQUIRED' });
    }

    const versions = await templateVersionRepository.findByTemplateId(templateId);
    return res.json({ versions });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const { templateId, versionLabel } = req.body || {};
    const numericTemplateId = Number(templateId);

    if (!numericTemplateId) {
      return res.status(400).json({ error: 'TEMPLATE_ID_REQUIRED' });
    }

    const result = await templateVersionRepository.createVersion({
      templateId: numericTemplateId,
      versionLabel: versionLabel || null,
      createdBy: req.user?.username || 'admin'
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { listByTemplate, create };
