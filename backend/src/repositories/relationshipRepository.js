const { execute } = require('../db/query');

async function findByVersionId(versionId) {
  const result = await execute(
    `SELECT r.relationship_id,
            r.version_id,
            r.relationship_code,
            r.relationship_name,
            r.source_entity_id,
            se.entity_code AS source_entity_code,
            se.entity_name AS source_entity_name,
            r.source_attribute_id,
            sa.attribute_code AS source_attribute_code,
            sa.attribute_name AS source_attribute_name,
            r.target_entity_id,
            te.entity_code AS target_entity_code,
            te.entity_name AS target_entity_name,
            r.target_attribute_id,
            ta.attribute_code AS target_attribute_code,
            ta.attribute_name AS target_attribute_name,
            r.relationship_type,
            r.label AS relationship_label,
            r.is_required,
            r.created_visually,
            r.is_active,
            r.created_at,
            r.created_by,
            r.updated_at,
            r.updated_by
       FROM opera_cfg_relationships r
       JOIN opera_cfg_entities se ON se.entity_id = r.source_entity_id
       JOIN opera_cfg_attributes sa ON sa.attribute_id = r.source_attribute_id
       JOIN opera_cfg_entities te ON te.entity_id = r.target_entity_id
       JOIN opera_cfg_attributes ta ON ta.attribute_id = r.target_attribute_id
      WHERE r.version_id = :versionId
        AND r.is_active = 'Y'
      ORDER BY r.label, r.relationship_id`,
    { versionId }
  );

  return result.rows;
}

async function createRelationship({
  versionId,
  sourceEntityId,
  sourceAttributeId,
  targetEntityId,
  targetAttributeId,
  relationshipType,
  relationshipCode,
  relationshipName,
  relationshipLabel,
  createdBy
}) {
  const result = await execute(
    `MERGE INTO opera_cfg_relationships r
     USING (
       SELECT :versionId version_id,
              :sourceAttributeId source_attribute_id,
              :targetAttributeId target_attribute_id
         FROM dual
     ) s
        ON (r.version_id = s.version_id
        AND r.source_attribute_id = s.source_attribute_id
        AND r.target_attribute_id = s.target_attribute_id)
      WHEN MATCHED THEN UPDATE SET
           r.relationship_code = :relationshipCode,
           r.relationship_name = :relationshipName,
           r.source_entity_id = :sourceEntityId,
           r.target_entity_id = :targetEntityId,
           r.relationship_type = :relationshipType,
           r.label = :relationshipLabel,
           r.created_visually = 'Y',
           r.is_active = 'Y',
           r.updated_by = :createdBy,
           r.updated_at = SYSTIMESTAMP
      WHEN NOT MATCHED THEN INSERT (
           version_id,
           relationship_code,
           relationship_name,
           source_entity_id,
           source_attribute_id,
           target_entity_id,
           target_attribute_id,
           relationship_type,
           is_required,
           label,
           created_visually,
           is_active,
           created_by
      ) VALUES (
           :versionId,
           :relationshipCode,
           :relationshipName,
           :sourceEntityId,
           :sourceAttributeId,
           :targetEntityId,
           :targetAttributeId,
           :relationshipType,
           'N',
           :relationshipLabel,
           'Y',
           'Y',
           :createdBy
      )`,
    {
      versionId,
      relationshipCode,
      relationshipName,
      sourceEntityId,
      sourceAttributeId,
      targetEntityId,
      targetAttributeId,
      relationshipType: relationshipType || 'REFERENCE',
      relationshipLabel: relationshipLabel || null,
      createdBy
    },
    { autoCommit: true }
  );

  return result.rowsAffected || 0;
}

async function deleteRelationship(relationshipId, updatedBy) {
  const result = await execute(
    `UPDATE opera_cfg_relationships
        SET is_active = 'N',
            updated_by = :updatedBy,
            updated_at = SYSTIMESTAMP
      WHERE relationship_id = :relationshipId`,
    { relationshipId, updatedBy },
    { autoCommit: true }
  );

  return result.rowsAffected || 0;
}

module.exports = { findByVersionId, createRelationship, deleteRelationship };
