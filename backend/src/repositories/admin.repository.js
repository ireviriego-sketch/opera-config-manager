const db = require('../config/database');

async function run(sql, binds = {}) {
  if (typeof db.execute === 'function') return db.execute(sql, binds);
  if (typeof db.query === 'function') return db.query(sql, binds);
  throw new Error('Database helper no compatible. Esperado execute(sql, binds) o query(sql, binds).');
}

function rows(result) {
  return result?.rows || result || [];
}

async function findUsers() {
  const result = await run(`
    SELECT
      u.USER_ID AS "userId",
      u.DISPLAY_NAME AS "displayName",
      u.EMAIL AS "email",
      NVL(r.ROLE_NAME, '-') AS "roleName",
      u.STATUS AS "status",
      TO_CHAR(u.UPDATED_AT, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
    FROM OPERA_CFG_USERS u
    LEFT JOIN OPERA_CFG_USER_ROLES ur ON ur.USER_ID = u.USER_ID
    LEFT JOIN OPERA_CFG_ROLES r ON r.ROLE_ID = ur.ROLE_ID
    ORDER BY UPPER(u.DISPLAY_NAME), UPPER(u.EMAIL)
  `);
  return rows(result);
}

async function findLovs() {
  const result = await run(`
    SELECT
      l.LOV_ID AS "lovId",
      l.LOV_CODE AS "lovCode",
      l.LOV_NAME AS "lovName",
      l.STATUS AS "status",
      COUNT(v.LOV_VALUE_ID) AS "valueCount",
      TO_CHAR(MAX(NVL(v.UPDATED_AT, l.UPDATED_AT)), 'YYYY-MM-DD HH24:MI') AS "updatedAt"
    FROM OPERA_CFG_LOV_LISTS l
    LEFT JOIN OPERA_CFG_LOV_VALUES v ON v.LOV_ID = l.LOV_ID
    GROUP BY l.LOV_ID, l.LOV_CODE, l.LOV_NAME, l.STATUS
    ORDER BY UPPER(l.LOV_CODE)
  `);
  return rows(result);
}

async function findLovValues(lovCode) {
  const result = await run(`
    SELECT
      v.LOV_VALUE_ID AS "lovValueId",
      v.VALUE_CODE AS "valueCode",
      v.VALUE_LABEL AS "valueLabel",
      v.SORT_ORDER AS "sortOrder",
      v.STATUS AS "status"
    FROM OPERA_CFG_LOV_LISTS l
    JOIN OPERA_CFG_LOV_VALUES v ON v.LOV_ID = l.LOV_ID
    WHERE UPPER(l.LOV_CODE) = UPPER(:lovCode)
    ORDER BY v.SORT_ORDER, UPPER(v.VALUE_LABEL)
  `, { lovCode });
  return rows(result);
}

module.exports = {
  findUsers,
  findLovs,
  findLovValues
};
