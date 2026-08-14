let db;
try { db = require('../config/database'); } catch { db = require('../db/oraclePool'); }

async function run(sql, binds = {}, options = {}) {
  if (typeof db.execute === 'function') return db.execute(sql, binds, options);
  if (typeof db.query === 'function') return db.query(sql, binds, options);
  const connection = typeof db.getConnection === 'function'
    ? await db.getConnection()
    : await db.getPool().getConnection();
  try {
    const result = await connection.execute(sql, binds, options);
    if (/^\s*(insert|update|delete|merge)/i.test(sql)) await connection.commit();
    return result;
  } finally {
    await connection.close();
  }
}

const rows = (result) => result?.rows || result || [];

async function findUsers() {
  const result = await run(`
    SELECT
      u.USER_ID AS "userId",
      u.USERNAME AS "username",
      u.FULL_NAME AS "fullName",
      u.EMAIL AS "email",
      u.STATUS AS "status",
      TO_CHAR(u.LAST_LOGIN_AT, 'YYYY-MM-DD HH24:MI') AS "lastLoginAt",
      LISTAGG(DISTINCT r.ROLE_CODE, ', ') WITHIN GROUP (ORDER BY r.ROLE_CODE) AS "roleCodes",
      COUNT(DISTINCT CASE WHEN p.SCOPE_TYPE = 'CHAIN' THEN p.USER_PERMISSION_ID END) AS "chainPermissionCount",
      COUNT(DISTINCT CASE WHEN p.SCOPE_TYPE = 'HOTEL' THEN p.USER_PERMISSION_ID END) AS "hotelPermissionCount",
      COUNT(DISTINCT CASE WHEN p.SCOPE_TYPE = 'GLOBAL' THEN p.USER_PERMISSION_ID END) AS "globalPermissionCount"
    FROM OPERA_CFG_USERS u
    LEFT JOIN OPERA_CFG_USER_ROLES ur ON ur.USER_ID = u.USER_ID
    LEFT JOIN OPERA_CFG_ROLES r ON r.ROLE_ID = ur.ROLE_ID
    LEFT JOIN OPERA_CFG_USER_PERMISSIONS p ON p.USER_ID = u.USER_ID
    GROUP BY u.USER_ID, u.USERNAME, u.FULL_NAME, u.EMAIL, u.STATUS, u.LAST_LOGIN_AT
    ORDER BY UPPER(u.USERNAME)
  `);
  return rows(result);
}

async function findUserById(userId) {
  const userResult = await run(`
    SELECT USER_ID AS "userId", USERNAME AS "username", FULL_NAME AS "fullName", EMAIL AS "email", STATUS AS "status"
    FROM OPERA_CFG_USERS
    WHERE USER_ID = :userId
  `, { userId });

  const roleResult = await run(`
    SELECT r.ROLE_ID AS "roleId", r.ROLE_CODE AS "roleCode", r.ROLE_NAME AS "roleName"
    FROM OPERA_CFG_USER_ROLES ur
    JOIN OPERA_CFG_ROLES r ON r.ROLE_ID = ur.ROLE_ID
    WHERE ur.USER_ID = :userId
    ORDER BY r.ROLE_CODE
  `, { userId });

  const permissionResult = await run(`
    SELECT
      p.USER_PERMISSION_ID AS "userPermissionId",
      p.USER_ID AS "userId",
      p.ROLE_ID AS "roleId",
      r.ROLE_CODE AS "roleCode",
      p.SCOPE_TYPE AS "scopeType",
      p.CHAIN_ID AS "chainId",
      c.CHAIN_NAME AS "chainName",
      p.HOTEL_ID AS "hotelId",
      h.HOTEL_NAME AS "hotelName",
      p.IS_READ_ONLY AS "isReadOnly"
    FROM OPERA_CFG_USER_PERMISSIONS p
    JOIN OPERA_CFG_ROLES r ON r.ROLE_ID = p.ROLE_ID
    LEFT JOIN OPERA_CFG_CHAINS c ON c.CHAIN_ID = p.CHAIN_ID
    LEFT JOIN OPERA_CFG_HOTELS h ON h.HOTEL_ID = p.HOTEL_ID
    WHERE p.USER_ID = :userId
    ORDER BY r.ROLE_CODE, p.SCOPE_TYPE, c.CHAIN_NAME, h.HOTEL_NAME
  `, { userId });

  const user = rows(userResult)[0];
  if (!user) return null;
  user.roles = rows(roleResult);
  user.permissions = rows(permissionResult);
  return user;
}

async function findRoles() {
  const result = await run(`
    SELECT
      r.ROLE_ID AS "roleId",
      r.ROLE_CODE AS "roleCode",
      r.ROLE_NAME AS "roleName",
      r.ROLE_DESCRIPTION AS "roleDescription",
      r.IS_SYSTEM_ROLE AS "isSystemRole",
      TO_CHAR(NVL(r.UPDATED_AT, r.CREATED_AT), 'YYYY-MM-DD HH24:MI') AS "updatedAt",
      COUNT(DISTINCT ur.USER_ID) AS "userCount",
      COUNT(DISTINCT p.USER_PERMISSION_ID) AS "permissionCount"
    FROM OPERA_CFG_ROLES r
    LEFT JOIN OPERA_CFG_USER_ROLES ur ON ur.ROLE_ID = r.ROLE_ID
    LEFT JOIN OPERA_CFG_USER_PERMISSIONS p ON p.ROLE_ID = r.ROLE_ID
    GROUP BY r.ROLE_ID, r.ROLE_CODE, r.ROLE_NAME, r.ROLE_DESCRIPTION, r.IS_SYSTEM_ROLE, NVL(r.UPDATED_AT, r.CREATED_AT)
    ORDER BY r.ROLE_CODE
  `);
  return rows(result);
}

async function findChains() {
  const result = await run(`
    SELECT CHAIN_ID AS "chainId", CHAIN_CODE AS "chainCode", CHAIN_NAME AS "chainName"
    FROM OPERA_CFG_CHAINS
    ORDER BY UPPER(CHAIN_NAME), UPPER(CHAIN_CODE)
  `);
  return rows(result);
}

async function findHotels() {
  const result = await run(`
    SELECT h.HOTEL_ID AS "hotelId", h.HOTEL_CODE AS "hotelCode", h.HOTEL_NAME AS "hotelName", h.CHAIN_ID AS "chainId", c.CHAIN_NAME AS "chainName"
    FROM OPERA_CFG_HOTELS h
    LEFT JOIN OPERA_CFG_CHAINS c ON c.CHAIN_ID = h.CHAIN_ID
    ORDER BY UPPER(c.CHAIN_NAME), UPPER(h.HOTEL_NAME), UPPER(h.HOTEL_CODE)
  `);
  return rows(result);
}

async function replaceUserRoles(userId, roleIds, assignedBy) {
  await run('DELETE FROM OPERA_CFG_USER_ROLES WHERE USER_ID = :userId', { userId });
  for (const roleId of roleIds || []) {
    await run(`INSERT INTO OPERA_CFG_USER_ROLES (USER_ID, ROLE_ID, ASSIGNED_BY) VALUES (:userId, :roleId, :assignedBy)`, { userId, roleId, assignedBy });
  }
}

async function replaceScopePermissions({ userId, roleId, scopeType, ids, isReadOnly, createdBy }) {
  const idColumn = scopeType === 'CHAIN' ? 'CHAIN_ID' : 'HOTEL_ID';
  await run(`DELETE FROM OPERA_CFG_USER_PERMISSIONS WHERE USER_ID = :userId AND ROLE_ID = :roleId AND SCOPE_TYPE = :scopeType`, { userId, roleId, scopeType });

  for (const id of ids || []) {
    await run(`
      INSERT INTO OPERA_CFG_USER_PERMISSIONS (USER_ID, ROLE_ID, SCOPE_TYPE, ${idColumn}, IS_READ_ONLY, CREATED_BY)
      VALUES (:userId, :roleId, :scopeType, :scopeId, :isReadOnly, :createdBy)
    `, { userId, roleId, scopeType, scopeId: id, isReadOnly: isReadOnly || 'N', createdBy });
  }
}

module.exports = {
  findUsers,
  findUserById,
  findRoles,
  findChains,
  findHotels,
  replaceUserRoles,
  replaceScopePermissions
};
