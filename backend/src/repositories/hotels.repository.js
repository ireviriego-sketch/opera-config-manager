const oracledb = require('oracledb');
const { execute } = require('../db/query');

function mapHotel(row) {
  return {
    hotelId: row.HOTEL_ID,
    chainId: row.CHAIN_ID,
    chainCode: row.CHAIN_CODE,
    chainName: row.CHAIN_NAME,
    hotelCode: row.HOTEL_CODE,
    hotelName: row.HOTEL_NAME,
    status: row.STATUS,
    createdAt: row.CREATED_AT,
    createdBy: row.CREATED_BY,
    updatedAt: row.UPDATED_AT,
    updatedBy: row.UPDATED_BY
  };
}

function forbidden(message = 'No tienes permiso sobre este hotel.') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

async function findAllForUser(userId) {
  const result = await execute(
    `SELECT DISTINCT
            h.hotel_id, h.chain_id, c.chain_code, c.chain_name, h.hotel_code, h.hotel_name, h.status,
            h.created_at, h.created_by, h.updated_at, h.updated_by
       FROM opera_cfg_hotels h
       JOIN opera_cfg_chains c ON c.chain_id = h.chain_id
       JOIN opera_cfg_user_permissions p
         ON p.user_id = :userId
        AND (
             (p.scope_type = 'HOTEL' AND p.hotel_id = h.hotel_id)
          OR (p.scope_type = 'CHAIN' AND p.chain_id = h.chain_id)
        )
       JOIN opera_cfg_user_roles ur ON ur.user_id = p.user_id
       JOIN opera_cfg_roles r ON r.role_id = ur.role_id
      WHERE (
             (p.scope_type = 'HOTEL' AND r.role_code = 'HOTEL_MANAGER')
          OR (p.scope_type = 'CHAIN' AND r.role_code = 'CHAIN_MANAGER')
      )
      ORDER BY UPPER(c.chain_name), UPPER(h.hotel_name)`,
    { userId: Number(userId) }
  );
  return result.rows.map(mapHotel);
}

async function findByChainIdForUser(chainId, userId) {
  const result = await execute(
    `SELECT DISTINCT
            h.hotel_id, h.chain_id, c.chain_code, c.chain_name, h.hotel_code, h.hotel_name, h.status,
            h.created_at, h.created_by, h.updated_at, h.updated_by
       FROM opera_cfg_hotels h
       JOIN opera_cfg_chains c ON c.chain_id = h.chain_id
       JOIN opera_cfg_user_permissions p
         ON p.user_id = :userId
        AND (
             (p.scope_type = 'CHAIN' AND p.chain_id = h.chain_id)
          OR (p.scope_type = 'HOTEL' AND p.hotel_id = h.hotel_id)
        )
       JOIN opera_cfg_user_roles ur ON ur.user_id = p.user_id
       JOIN opera_cfg_roles r ON r.role_id = ur.role_id
      WHERE h.chain_id = :chainId
        AND (
             (p.scope_type = 'CHAIN' AND r.role_code = 'CHAIN_MANAGER')
          OR (p.scope_type = 'HOTEL' AND r.role_code = 'HOTEL_MANAGER')
        )
      ORDER BY UPPER(h.hotel_name)`,
    { chainId: Number(chainId), userId: Number(userId) }
  );
  return result.rows.map(mapHotel);
}

async function hasHotelAccess(hotelId, userId) {
  const result = await execute(
    `SELECT 1 AS has_access
       FROM opera_cfg_hotels h
       JOIN opera_cfg_user_permissions p
         ON p.user_id = :userId
        AND (
             (p.scope_type = 'HOTEL' AND p.hotel_id = h.hotel_id)
          OR (p.scope_type = 'CHAIN' AND p.chain_id = h.chain_id)
        )
       JOIN opera_cfg_user_roles ur ON ur.user_id = p.user_id
       JOIN opera_cfg_roles r ON r.role_id = ur.role_id
      WHERE h.hotel_id = :hotelId
        AND (
             (p.scope_type = 'HOTEL' AND r.role_code = 'HOTEL_MANAGER')
          OR (p.scope_type = 'CHAIN' AND r.role_code = 'CHAIN_MANAGER')
        )
      FETCH FIRST 1 ROWS ONLY`,
    { hotelId: Number(hotelId), userId: Number(userId) }
  );
  return !!result.rows.length;
}

async function hasChainHotelCreateAccess(chainId, userId) {
  const result = await execute(
    `SELECT 1 AS has_access
       FROM opera_cfg_user_permissions p
       JOIN opera_cfg_user_roles ur ON ur.user_id = p.user_id
       JOIN opera_cfg_roles r ON r.role_id = ur.role_id
      WHERE p.user_id = :userId
        AND p.scope_type = 'CHAIN'
        AND p.chain_id = :chainId
        AND r.role_code = 'CHAIN_MANAGER'
      FETCH FIRST 1 ROWS ONLY`,
    { chainId: Number(chainId), userId: Number(userId) }
  );
  return !!result.rows.length;
}

async function findById(hotelId) {
  const result = await execute(
    `SELECT h.hotel_id, h.chain_id, c.chain_code, c.chain_name, h.hotel_code, h.hotel_name, h.status,
            h.created_at, h.created_by, h.updated_at, h.updated_by
       FROM opera_cfg_hotels h
       JOIN opera_cfg_chains c ON c.chain_id = h.chain_id
      WHERE h.hotel_id = :hotelId`,
    { hotelId: Number(hotelId) }
  );
  return result.rows[0] ? mapHotel(result.rows[0]) : null;
}

async function createHotel(chainId, { hotelCode, hotelName, status, createdBy }) {
  const result = await execute(
    `INSERT INTO opera_cfg_hotels (chain_id, hotel_code, hotel_name, status, created_by)
     VALUES (:chainId, :hotelCode, :hotelName, :status, :createdBy)
     RETURNING hotel_id INTO :hotelId`,
    { chainId: Number(chainId), hotelCode, hotelName, status, createdBy, hotelId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    { autoCommit: true }
  );
  return findById(result.outBinds.hotelId[0]);
}

async function updateHotel(chainId, hotelId, { hotelCode, hotelName, status, updatedBy }) {
  const result = await execute(
    `UPDATE opera_cfg_hotels
        SET hotel_code = :hotelCode,
            hotel_name = :hotelName,
            status = :status,
            updated_at = SYSTIMESTAMP,
            updated_by = :updatedBy
      WHERE chain_id = :chainId
        AND hotel_id = :hotelId`,
    { chainId: Number(chainId), hotelId: Number(hotelId), hotelCode, hotelName, status, updatedBy },
    { autoCommit: true }
  );
  if (!result.rowsAffected) return null;
  return findById(hotelId);
}

async function createHotelForUser(chainId, userId, payload) {
  const allowed = await hasChainHotelCreateAccess(chainId, userId);
  if (!allowed) throw forbidden('No tienes permiso para crear hoteles en esta cadena.');
  return createHotel(chainId, payload);
}

async function updateHotelForUser(chainId, hotelId, userId, payload) {
  const allowed = await hasHotelAccess(hotelId, userId);
  if (!allowed) throw forbidden();
  return updateHotel(chainId, hotelId, payload);
}

module.exports = {
  findAllForUser,
  findByChainIdForUser,
  findById,
  hasHotelAccess,
  createHotel,
  createHotelForUser,
  updateHotel,
  updateHotelForUser
};
