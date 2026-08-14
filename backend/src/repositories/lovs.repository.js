const oracledb = require('oracledb');
const { execute } = require('../db/query');

function mapLov(row) {
  return {
    lovId: row.LOV_ID,
    lovCode: row.LOV_CODE,
    lovName: row.LOV_NAME,
    description: row.DESCRIPTION,
    status: row.STATUS,
    parentLovId: row.PARENT_LOV_ID,
    parentLovCode: row.PARENT_LOV_CODE,
    parentLovName: row.PARENT_LOV_NAME,
    valueCount: row.VALUE_COUNT || 0,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

function mapLovValue(row) {
  return {
    lovValueId: row.LOV_VALUE_ID,
    lovId: row.LOV_ID,
    valueCode: row.VALUE_CODE,
    valueLabel: row.VALUE_LABEL,
    sortOrder: row.SORT_ORDER,
    status: row.STATUS,
    parentLovValueId: row.PARENT_LOV_VALUE_ID,
    parentValueCode: row.PARENT_VALUE_CODE,
    parentValueLabel: row.PARENT_VALUE_LABEL,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

async function findLovs({ includeInactive = true, q = null } = {}) {
  const where = ['1 = 1'];
  const binds = {};
  if (!includeInactive) where.push("l.STATUS = 'ACTIVE'");
  if (q && String(q).trim()) {
    where.push(`(
      UPPER(l.LOV_CODE) LIKE UPPER(:q)
      OR UPPER(l.LOV_NAME) LIKE UPPER(:q)
      OR UPPER(l.DESCRIPTION) LIKE UPPER(:q)
      OR UPPER(parent_lov.LOV_CODE) LIKE UPPER(:q)
    )`);
    binds.q = `%${q}%`;
  }

  const result = await execute(
    `SELECT
       l.LOV_ID,
       l.LOV_CODE,
       l.LOV_NAME,
       l.DESCRIPTION,
       l.STATUS,
       l.PARENT_LOV_ID,
       parent_lov.LOV_CODE AS PARENT_LOV_CODE,
       parent_lov.LOV_NAME AS PARENT_LOV_NAME,
       TO_CHAR(l.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
       TO_CHAR(l.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT,
       COUNT(v.LOV_VALUE_ID) AS VALUE_COUNT
     FROM OPERA_CFG_LOV_LISTS l
     LEFT JOIN OPERA_CFG_LOV_LISTS parent_lov ON parent_lov.LOV_ID = l.PARENT_LOV_ID
     LEFT JOIN OPERA_CFG_LOV_VALUES v ON v.LOV_ID = l.LOV_ID
     WHERE ${where.join(' AND ')}
     GROUP BY l.LOV_ID, l.LOV_CODE, l.LOV_NAME, l.DESCRIPTION, l.STATUS, l.PARENT_LOV_ID,
              parent_lov.LOV_CODE, parent_lov.LOV_NAME, l.CREATED_AT, l.UPDATED_AT
     ORDER BY UPPER(l.LOV_CODE)`,
    binds
  );
  return result.rows.map(mapLov);
}

async function findLovById(lovId) {
  const result = await execute(
    `SELECT
       l.LOV_ID,
       l.LOV_CODE,
       l.LOV_NAME,
       l.DESCRIPTION,
       l.STATUS,
       l.PARENT_LOV_ID,
       parent_lov.LOV_CODE AS PARENT_LOV_CODE,
       parent_lov.LOV_NAME AS PARENT_LOV_NAME,
       TO_CHAR(l.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
       TO_CHAR(l.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT,
       (SELECT COUNT(*) FROM OPERA_CFG_LOV_VALUES v WHERE v.LOV_ID = l.LOV_ID) AS VALUE_COUNT
     FROM OPERA_CFG_LOV_LISTS l
     LEFT JOIN OPERA_CFG_LOV_LISTS parent_lov ON parent_lov.LOV_ID = l.PARENT_LOV_ID
     WHERE l.LOV_ID = :lovId`,
    { lovId: Number(lovId) }
  );
  return result.rows[0] ? mapLov(result.rows[0]) : null;
}

async function findLovByCode(lovCode) {
  const result = await execute(
    `SELECT
       l.LOV_ID,
       l.LOV_CODE,
       l.LOV_NAME,
       l.DESCRIPTION,
       l.STATUS,
       l.PARENT_LOV_ID,
       parent_lov.LOV_CODE AS PARENT_LOV_CODE,
       parent_lov.LOV_NAME AS PARENT_LOV_NAME,
       TO_CHAR(l.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
       TO_CHAR(l.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT,
       (SELECT COUNT(*) FROM OPERA_CFG_LOV_VALUES v WHERE v.LOV_ID = l.LOV_ID) AS VALUE_COUNT
     FROM OPERA_CFG_LOV_LISTS l
     LEFT JOIN OPERA_CFG_LOV_LISTS parent_lov ON parent_lov.LOV_ID = l.PARENT_LOV_ID
     WHERE UPPER(l.LOV_CODE) = UPPER(:lovCode)`,
    { lovCode }
  );
  return result.rows[0] ? mapLov(result.rows[0]) : null;
}

async function createLov({ lovCode, lovName, description, status, parentLovId }) {
  const result = await execute(
    `INSERT INTO OPERA_CFG_LOV_LISTS (LOV_CODE, LOV_NAME, DESCRIPTION, STATUS, PARENT_LOV_ID)
     VALUES (:lovCode, :lovName, :description, :status, :parentLovId)
     RETURNING LOV_ID INTO :lovId`,
    {
      lovCode: String(lovCode).trim().toUpperCase(),
      lovName: String(lovName).trim(),
      description: description || null,
      status: status || 'ACTIVE',
      parentLovId: parentLovId ? Number(parentLovId) : null,
      lovId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
    { autoCommit: true }
  );
  return findLovById(result.outBinds.lovId[0]);
}

async function updateLov(lovId, { lovCode, lovName, description, status, parentLovId }) {
  const result = await execute(
    `UPDATE OPERA_CFG_LOV_LISTS
        SET LOV_CODE = :lovCode,
            LOV_NAME = :lovName,
            DESCRIPTION = :description,
            STATUS = :status,
            PARENT_LOV_ID = :parentLovId,
            UPDATED_AT = SYSTIMESTAMP
      WHERE LOV_ID = :lovId`,
    {
      lovId: Number(lovId),
      lovCode: String(lovCode).trim().toUpperCase(),
      lovName: String(lovName).trim(),
      description: description || null,
      status: status || 'ACTIVE',
      parentLovId: parentLovId ? Number(parentLovId) : null
    },
    { autoCommit: true }
  );
  if (!result.rowsAffected) return null;
  return findLovById(lovId);
}

async function deactivateLov(lovId) {
  const result = await execute(
    `UPDATE OPERA_CFG_LOV_LISTS
        SET STATUS = 'INACTIVE',
            UPDATED_AT = SYSTIMESTAMP
      WHERE LOV_ID = :lovId`,
    { lovId: Number(lovId) },
    { autoCommit: true }
  );
  return !!result.rowsAffected;
}

async function findValuesByLovId(lovId, { includeInactive = true, parentLovValueId = null } = {}) {
  const where = ['v.LOV_ID = :lovId'];
  const binds = { lovId: Number(lovId) };
  if (!includeInactive) where.push("v.STATUS = 'ACTIVE'");
  if (parentLovValueId) {
    where.push('v.PARENT_LOV_VALUE_ID = :parentLovValueId');
    binds.parentLovValueId = Number(parentLovValueId);
  }

  const result = await execute(
    `SELECT
       v.LOV_VALUE_ID,
       v.LOV_ID,
       v.VALUE_CODE,
       v.VALUE_LABEL,
       v.SORT_ORDER,
       v.STATUS,
       v.PARENT_LOV_VALUE_ID,
       parent_value.VALUE_CODE AS PARENT_VALUE_CODE,
       parent_value.VALUE_LABEL AS PARENT_VALUE_LABEL,
       TO_CHAR(v.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
       TO_CHAR(v.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT
     FROM OPERA_CFG_LOV_VALUES v
     LEFT JOIN OPERA_CFG_LOV_VALUES parent_value ON parent_value.LOV_VALUE_ID = v.PARENT_LOV_VALUE_ID
     WHERE ${where.join(' AND ')}
     ORDER BY v.SORT_ORDER, UPPER(v.VALUE_LABEL)`,
    binds
  );
  return result.rows.map(mapLovValue);
}

async function findValueById(lovValueId) {
  const result = await execute(
    `SELECT
       v.LOV_VALUE_ID,
       v.LOV_ID,
       v.VALUE_CODE,
       v.VALUE_LABEL,
       v.SORT_ORDER,
       v.STATUS,
       v.PARENT_LOV_VALUE_ID,
       parent_value.VALUE_CODE AS PARENT_VALUE_CODE,
       parent_value.VALUE_LABEL AS PARENT_VALUE_LABEL,
       TO_CHAR(v.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
       TO_CHAR(v.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT
     FROM OPERA_CFG_LOV_VALUES v
     LEFT JOIN OPERA_CFG_LOV_VALUES parent_value ON parent_value.LOV_VALUE_ID = v.PARENT_LOV_VALUE_ID
     WHERE v.LOV_VALUE_ID = :lovValueId`,
    { lovValueId: Number(lovValueId) }
  );
  return result.rows[0] ? mapLovValue(result.rows[0]) : null;
}

async function findValueByCode(lovId, valueCode) {
  const result = await execute(
    `SELECT LOV_VALUE_ID
       FROM OPERA_CFG_LOV_VALUES
      WHERE LOV_ID = :lovId
        AND UPPER(VALUE_CODE) = UPPER(:valueCode)`,
    { lovId: Number(lovId), valueCode }
  );
  return result.rows[0]?.LOV_VALUE_ID || null;
}

async function createValue(lovId, { valueCode, valueLabel, sortOrder, status, parentLovValueId }) {
  const result = await execute(
    `INSERT INTO OPERA_CFG_LOV_VALUES (LOV_ID, VALUE_CODE, VALUE_LABEL, SORT_ORDER, STATUS, PARENT_LOV_VALUE_ID)
     VALUES (:lovId, :valueCode, :valueLabel, :sortOrder, :status, :parentLovValueId)
     RETURNING LOV_VALUE_ID INTO :lovValueId`,
    {
      lovId: Number(lovId),
      valueCode: String(valueCode).trim().toUpperCase(),
      valueLabel: String(valueLabel).trim(),
      sortOrder: Number(sortOrder || 10),
      status: status || 'ACTIVE',
      parentLovValueId: parentLovValueId ? Number(parentLovValueId) : null,
      lovValueId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
    { autoCommit: true }
  );
  return findValueById(result.outBinds.lovValueId[0]);
}

async function updateValue(lovId, lovValueId, { valueCode, valueLabel, sortOrder, status, parentLovValueId }) {
  const result = await execute(
    `UPDATE OPERA_CFG_LOV_VALUES
        SET VALUE_CODE = :valueCode,
            VALUE_LABEL = :valueLabel,
            SORT_ORDER = :sortOrder,
            STATUS = :status,
            PARENT_LOV_VALUE_ID = :parentLovValueId,
            UPDATED_AT = SYSTIMESTAMP
      WHERE LOV_ID = :lovId
        AND LOV_VALUE_ID = :lovValueId`,
    {
      lovId: Number(lovId),
      lovValueId: Number(lovValueId),
      valueCode: String(valueCode).trim().toUpperCase(),
      valueLabel: String(valueLabel).trim(),
      sortOrder: Number(sortOrder || 10),
      status: status || 'ACTIVE',
      parentLovValueId: parentLovValueId ? Number(parentLovValueId) : null
    },
    { autoCommit: true }
  );
  if (!result.rowsAffected) return null;
  return findValueById(lovValueId);
}

async function deactivateValue(lovId, lovValueId) {
  const result = await execute(
    `UPDATE OPERA_CFG_LOV_VALUES
        SET STATUS = 'INACTIVE',
            UPDATED_AT = SYSTIMESTAMP
      WHERE LOV_ID = :lovId
        AND LOV_VALUE_ID = :lovValueId`,
    { lovId: Number(lovId), lovValueId: Number(lovValueId) },
    { autoCommit: true }
  );
  return !!result.rowsAffected;
}

module.exports = {
  findLovs,
  findLovById,
  findLovByCode,
  createLov,
  updateLov,
  deactivateLov,
  findValuesByLovId,
  findValueById,
  findValueByCode,
  createValue,
  updateValue,
  deactivateValue
};
