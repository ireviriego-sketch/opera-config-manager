const attributeRepository = require('../repositories/attributeRepository');

async function listByEntity(req, res, next) {
  try {
    const entityId = Number(req.query.entityId);

    if (!entityId) {
      return res.status(400).json({ error: 'ENTITY_ID_REQUIRED' });
    }

    const attributes = await attributeRepository.findByEntityId(entityId);
    return res.json({ attributes });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const {
      entityId,
      code,
      name,
      description,
      dataTypeCode,
      isRequired,
      maxLength,
      defaultValue,
      isKeyAttribute,
      displayOrder
    } = req.body || {};

    const numericEntityId = Number(entityId);

    if (!numericEntityId) {
      return res.status(400).json({ error: 'ENTITY_ID_REQUIRED' });
    }

    if (!code || !name || !dataTypeCode) {
      return res.status(400).json({ error: 'CODE_NAME_AND_TYPE_REQUIRED' });
    }

    const attributeId = await attributeRepository.createAttribute({
      entityId: numericEntityId,
      code,
      name,
      description: description || null,
      dataTypeCode,
      isRequired: isRequired === 'Y' ? 'Y' : 'N',
      maxLength: maxLength ? Number(maxLength) : null,
      defaultValue: defaultValue || null,
      isKeyAttribute: isKeyAttribute === 'Y' ? 'Y' : 'N',
      displayOrder: Number(displayOrder || 0),
      createdBy: req.user?.username || 'admin'
    });

    return res.status(201).json({ attributeId });
  } catch (error) {
    return next(error);
  }
}

async function listDataTypes(req, res, next) {
  try {
    const dataTypes = await attributeRepository.findDataTypes();
    return res.json({ dataTypes });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listByEntity, create, listDataTypes };
