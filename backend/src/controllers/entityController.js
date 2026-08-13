const entityRepository = require('../repositories/entityRepository');

async function listByDomain(req, res, next) {
  try {
    const domainId = Number(req.query.domainId);

    if (!domainId) {
      return res.status(400).json({ error: 'DOMAIN_ID_REQUIRED' });
    }

    const entities = await entityRepository.findByDomainId(domainId);
    return res.json({ entities });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const { domainId, code, name, description, sourceSectionName, displayOrder } = req.body || {};
    const numericDomainId = Number(domainId);

    if (!numericDomainId) {
      return res.status(400).json({ error: 'DOMAIN_ID_REQUIRED' });
    }

    if (!code || !name) {
      return res.status(400).json({ error: 'CODE_AND_NAME_REQUIRED' });
    }

    const entityId = await entityRepository.createEntity({
      domainId: numericDomainId,
      code,
      name,
      description: description || null,
      sourceSectionName: sourceSectionName || null,
      displayOrder: Number(displayOrder || 0),
      createdBy: req.user?.username || 'admin'
    });

    return res.status(201).json({ entityId });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listByDomain, create };
