const relationshipRepository = require('../repositories/relationshipRepository');

function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

async function listByVersion(req, res, next) {
  try {
    const versionId = Number(req.query.versionId);

    if (!versionId) {
      return res.status(400).json({ error: 'VERSION_ID_REQUIRED' });
    }

    const relationships = await relationshipRepository.findByVersionId(versionId);
    return res.json({ relationships });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const {
      versionId,
      sourceEntityId,
      sourceAttributeId,
      targetEntityId,
      targetAttributeId,
      relationshipType,
      relationshipLabel
    } = req.body || {};

    const numericVersionId = Number(versionId);
    const numericSourceEntityId = Number(sourceEntityId);
    const numericSourceAttributeId = Number(sourceAttributeId);
    const numericTargetEntityId = Number(targetEntityId);
    const numericTargetAttributeId = Number(targetAttributeId);

    if (!numericVersionId || !numericSourceEntityId || !numericSourceAttributeId || !numericTargetEntityId || !numericTargetAttributeId) {
      return res.status(400).json({ error: 'RELATIONSHIP_FIELDS_REQUIRED' });
    }

    if (numericSourceAttributeId === numericTargetAttributeId) {
      return res.status(400).json({ error: 'SOURCE_AND_TARGET_MUST_DIFFER' });
    }

    const safeType = relationshipType || 'REFERENCE';
    const safeLabel = relationshipLabel || `REL ${numericSourceAttributeId} TO ${numericTargetAttributeId}`;
    const relationshipCode = normalizeCode(`REL_${numericSourceAttributeId}_TO_${numericTargetAttributeId}`);
    const relationshipName = String(safeLabel).slice(0, 200);

    const rowsAffected = await relationshipRepository.createRelationship({
      versionId: numericVersionId,
      sourceEntityId: numericSourceEntityId,
      sourceAttributeId: numericSourceAttributeId,
      targetEntityId: numericTargetEntityId,
      targetAttributeId: numericTargetAttributeId,
      relationshipType: safeType,
      relationshipCode,
      relationshipName,
      relationshipLabel: safeLabel,
      createdBy: req.user?.username || 'admin'
    });

    return res.status(201).json({ saved: true, rowsAffected });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const relationshipId = Number(req.params.id);

    if (!relationshipId) {
      return res.status(400).json({ error: 'RELATIONSHIP_ID_REQUIRED' });
    }

    const rowsAffected = await relationshipRepository.deleteRelationship(
      relationshipId,
      req.user?.username || 'admin'
    );

    if (!rowsAffected) {
      return res.status(404).json({ error: 'RELATIONSHIP_NOT_FOUND' });
    }

    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listByVersion, create, remove };
