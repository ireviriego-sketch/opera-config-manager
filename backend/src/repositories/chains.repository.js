const oracledb = require('oracledb');
const { execute, executeTransaction } = require('../db/query');

function mapChain(row) {
  return {
    chainId: row.CHAIN_ID,
    chainCode: row.CHAIN_CODE,
    chainName: row.CHAIN_NAME,
    status: row.STATUS,
    createdAt: row.CREATED_AT,
    createdBy: row.CREATED_BY,
    updatedAt: row.UPDATED_AT,
    updatedBy: row.UPDATED_BY,
    hotelsCount: row.HOTELS_COUNT || 0
  };
}

function forbidden(message = 'No tienes permiso sobre esta cadena.') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

async function findAllForUser(userId) {
  const result = await execute(
    `SELECT
       c.chain_id,
       c.chain_code,
       c.chain_name,
       c.status,
       c.created_at,
       c.created_by,
       c.updated_at,
       c.updated_by,
       COUNT(h.hotel_id) AS hotels_count
     FROM opera_cfg_chains c
     JOIN opera_cfg_user_permissions p
       ON p.chain_id = c.chain_id
      AND p.scope_type = 'CHAIN'
      AND p.user_id = :userId
     JOIN opera_cfg_user_roles ur
       ON ur.user_id = p.user_id
     JOIN opera_cfg_roles r
       ON r.role_id = ur.role_id
      AND r.role_code = 'CHAIN_MANAGER'
     LEFT JOIN opera_cfg_hotels h
       ON h.chain_id = c.chain_id
     GROUP BY c.chain_id, c.chain_code, c.chain_name, c.status, c.created_at, c.created_by, c.updated_at, c.updated_by
     ORDER BY UPPER(c.chain_name)`,
    { userId: Number(userId) }
  );

  return result.rows.map(mapChain);
}

async function findAll() {
  const result = await execute(
    `SELECT
       c.chain_id,
       c.chain_code,
       c.chain_name,
       c.status,
       c.created_at,
       c.created_by,
       c.updated_at,
       c.updated_by,
       COUNT(h.hotel_id) AS hotels_count
     FROM opera_cfg_chains c
     LEFT JOIN opera_cfg_hotels h ON h.chain_id = c.chain_id
     GROUP BY c.chain_id, c.chain_code, c.chain_name, c.status, c.created_at, c.created_by, c.updated_at, c.updated_by
     ORDER BY UPPER(c.chain_name)`
  );
  return result.rows.map(mapChain);
}

async function findById(chainId) {
  const result = await execute(
    `SELECT
       c.chain_id,
       c.chain_code,
       c.chain_name,
       c.status,
       c.created_at,
       c.created_by,
       c.updated_at,
       c.updated_by,
       (SELECT COUNT(*) FROM opera_cfg_hotels h WHERE h.chain_id = c.chain_id) AS hotels_count
     FROM opera_cfg_chains c
     WHERE c.chain_id = :chainId`,
    { chainId: Number(chainId) }
  );
  return result.rows[0] ? mapChain(result.rows[0]) : null;
}

async function findByIdForUser(chainId, userId) {
  const result = await execute(
    `SELECT
       c.chain_id,
       c.chain_code,
       c.chain_name,
       c.status,
       c.created_at,
       c.created_by,
       c.updated_at,
       c.updated_by,
       (SELECT COUNT(*) FROM opera_cfg_hotels h WHERE h.chain_id = c.chain_id) AS hotels_count
     FROM opera_cfg_chains c
     JOIN opera_cfg_user_permissions p
       ON p.chain_id = c.chain_id
      AND p.scope_type = 'CHAIN'
      AND p.user_id = :userId
     JOIN opera_cfg_user_roles ur
       ON ur.user_id = p.user_id
     JOIN opera_cfg_roles r
       ON r.role_id = ur.role_id
      AND r.role_code = 'CHAIN_MANAGER'
     WHERE c.chain_id = :chainId`,
    { chainId: Number(chainId), userId: Number(userId) }
  );
  return result.rows[0] ? mapChain(result.rows[0]) : null;
}

async function hasChainAccess(chainId, userId) {
  const result = await execute(
    `SELECT 1 AS has_access
       FROM opera_cfg_user_permissions p
       JOIN opera_cfg_user_roles ur
         ON ur.user_id = p.user_id
       JOIN opera_cfg_roles r
         ON r.role_id = ur.role_id
        AND r.role_code = 'CHAIN_MANAGER'
      WHERE p.user_id = :userId
        AND p.scope_type = 'CHAIN'
        AND p.chain_id = :chainId
      FETCH FIRST 1 ROWS ONLY`,
    { chainId: Number(chainId), userId: Number(userId) }
  );
  return !!result.rows.length;
}

async function createChain({ chainCode, chainName, status, createdBy }) {
  const result = await execute(
    `INSERT INTO opera_cfg_chains (chain_code, chain_name, status, created_by)
     VALUES (:chainCode, :chainName, :status, :createdBy)
     RETURNING chain_id INTO :chainId`,
    { chainCode, chainName, status, createdBy, chainId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    { autoCommit: true }
  );
  return findById(result.outBinds.chainId[0]);
}

async function updateChain(chainId, { chainCode, chainName, status, updatedBy }) {
  const result = await execute(
    `UPDATE opera_cfg_chains
        SET chain_code = :chainCode,
            chain_name = :chainName,
            status = :status,
            updated_at = SYSTIMESTAMP,
            updated_by = :updatedBy
      WHERE chain_id = :chainId`,
    { chainId: Number(chainId), chainCode, chainName, status, updatedBy },
    { autoCommit: true }
  );
  if (!result.rowsAffected) return null;
  return findById(chainId);
}

async function updateChainForUser(chainId, userId, payload) {
  const allowed = await hasChainAccess(chainId, userId);
  if (!allowed) throw forbidden();
  return updateChain(chainId, payload);
}

async function upsertImportedHotels(chainId, hotels, userName) {
  return executeTransaction(async connection => {
    let imported = 0;
    let updated = 0;
    for (const hotel of hotels) {
      const existing = await connection.execute(
        `SELECT hotel_id FROM opera_cfg_hotels WHERE chain_id = :chainId AND hotel_code = :hotelCode`,
        { chainId: Number(chainId), hotelCode: hotel.hotelCode }
      );
      if (existing.rows.length) {
        await connection.execute(
          `UPDATE opera_cfg_hotels
              SET hotel_name = :hotelName,
                  status = :status,
                  updated_at = SYSTIMESTAMP,
                  updated_by = :updatedBy
            WHERE chain_id = :chainId
              AND hotel_code = :hotelCode`,
          { chainId: Number(chainId), hotelCode: hotel.hotelCode, hotelName: hotel.hotelName, status: hotel.status || 'ACTIVE', updatedBy: userName || null }
        );
        updated += 1;
      } else {
        await connection.execute(
          `INSERT INTO opera_cfg_hotels (chain_id, hotel_code, hotel_name, status, created_by)
           VALUES (:chainId, :hotelCode, :hotelName, :status, :createdBy)`,
          { chainId: Number(chainId), hotelCode: hotel.hotelCode, hotelName: hotel.hotelName, status: hotel.status || 'ACTIVE', createdBy: userName || null }
        );
        imported += 1;
      }
    }
    return { imported, updated };
  });
}

module.exports = {
  findAll,
  findAllForUser,
  findById,
  findByIdForUser,
  hasChainAccess,
  createChain,
  updateChain,
  updateChainForUser,
  upsertImportedHotels
};
