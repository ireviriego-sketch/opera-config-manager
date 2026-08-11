const oracledb = require('oracledb');
const { execute } = require('../db/query');

async function findByEntityId(entityId) {
  const result = await execute(
    `SELECT a.attribute_id,
            a.entity_id,
            a.attribute_code,
            a.attribute_name,
            a.attribute_description,
            a.data_type_id,
            dt.data_type_code,
            dt.data_type_name,
            a.is_required,
            a.max_length,
            a.numeric_precision,
            a.numeric_scale,
            a.default_value,
            a.lov_code,
            a.is_key_attribute,
            a.display_order,
            a.is_active,
            a.created_at,
            a.created_by,
            a.updated_at,
            a.updated_by
       FROM opera_cfg_attributes a
       JOIN opera_cfg_data_types dt ON dt.data_type_id = a.data_type_id
      WHERE a.entity_id = :entityId
      ORDER BY a.display_order, a.attribute_name`,
    { entityId }
  );

  return result.rows;
}

async function createAttribute({
  entityId,
  code,
  name,
  description,
  dataTypeCode,
  isRequired,
  maxLength,
  defaultValue,
  isKeyAttribute,
  displayOrder,
  createdBy
}) {
  const result = await execute(
    `INSERT INTO opera_cfg_attributes (
        entity_id,
        attribute_code,
        attribute_name,
        attribute_description,
        data_type_id,
        is_required,
        max_length,
        default_value,
        is_key_attribute,
        display_order,
        is_active,
        created_by
     ) VALUES (
        :entityId,
        :code,
        :name,
        :description,
        (SELECT data_type_id FROM opera_cfg_data_types WHERE data_type_code = :dataTypeCode),
        :isRequired,
        :maxLength,
        :defaultValue,
        :isKeyAttribute,
        :displayOrder,
        'Y',
        :createdBy
     ) RETURNING attribute_id INTO :attributeId`,
    {
      entityId,
      code,
      name,
      description,
      dataTypeCode,
      isRequired: isRequired || 'N',
      maxLength: maxLength || null,
      defaultValue: defaultValue || null,
      isKeyAttribute: isKeyAttribute || 'N',
      displayOrder: displayOrder || 0,
      createdBy,
      attributeId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
    { autoCommit: true }
  );

  return result.outBinds.attributeId[0];
}

async function findDataTypes() {
  const result = await execute(
    `SELECT data_type_id,
            data_type_code,
            data_type_name,
            description
       FROM opera_cfg_data_types
      ORDER BY data_type_name`
  );

  return result.rows;
}

module.exports = { findByEntityId, createAttribute, findDataTypes };
