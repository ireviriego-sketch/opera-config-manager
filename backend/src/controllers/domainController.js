const domainRepository = require('../repositories/domainRepository');

async function listByVersion(req, res, next) {
  try {
    const versionId = Number(req.query.versionId);

    if (!versionId) {
      return res.status(400).json({ error: 'VERSION_ID_REQUIRED' });
    }

    const domains = await domainRepository.findByVersionId(versionId);
    return res.json({ domains });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const { versionId, code, name, description, displayOrder } = req.body || {};
    const numericVersionId = Number(versionId);

    if (!numericVersionId) {
      return res.status(400).json({ error: 'VERSION_ID_REQUIRED' });
    }

    if (!code || !name) {
      return res.status(400).json({ error: 'CODE_AND_NAME_REQUIRED' });
    }

    const domainId = await domainRepository.createDomain({
      versionId: numericVersionId,
      code,
      name,
      description: description || null,
      displayOrder: Number(displayOrder || 0),
      createdBy: req.user?.username || 'admin'
    });

    return res.status(201).json({ domainId });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listByVersion, create };
