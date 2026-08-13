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

async function findAll(filters = {}) {
  const search = String(filters.search || '').trim().toUpperCase();
  const binds = {};
  let where = '1 = 1';

  if (search) {
    binds.search = `%${search}%`;
    where += `
      AND (
        UPPER(h.hotel_code) LIKE :search
        OR UPPER(h.hotel_name) LIKE :search
        OR UPPER(c.chain_code) LIKE :search
        OR UPPER(c.chain_name) LIKE :search
        OR UPPER(h.status) LIKE :search
      )`;
  }

  const result = await execute(
    `SELECT h.hotel_id,
            h.chain_id,
            c.chain_code,
            c.chain_name,
            h.hotel_code,
            h.hotel_name,
            h.status,
            h.created_at,
            h.created_by,
            h.updated_at,
            h.updated_by
       FROM opera_cfg_hotels h
       JOIN opera_cfg_chains c
         ON c.chain_id = h.chain_id
      WHERE ${where}
      ORDER BY UPPER(h.hotel_name), UPPER(c.chain_name)`,
    binds
  );

  return result.rows.map(mapHotel);
}

async function findByChainId(chainId) {
  const result = await execute(
    `SELECT h.hotel_id,
            h.chain_id,
            c.chain_code,
            c.chain_name,
            h.hotel_code,
            h.hotel_name,
            h.status,
            h.created_at,
            h.created_by,
            h.updated_at,
            h.updated_by
       FROM opera_cfg_hotels h
       JOIN opera_cfg_chains c
         ON c.chain_id = h.chain_id
      WHERE h.chain_id = :chainId
      ORDER BY UPPER(h.hotel_name)`,
    { chainId: Number(chainId) }
  );
  return result.rows.map(mapHotel);
}

async function findById(hotelId) {
  const result = await execute(
    `SELECT h.hotel_id,
            h.chain_id,
            c.chain_code,
            c.chain_name,
            h.hotel_code,
            h.hotel_name,
            h.status,
            h.created_at,
            h.created_by,
            h.updated_at,
            h.updated_by
       FROM opera_cfg_hotels h
       JOIN opera_cfg_chains c
         ON c.chain_id = h.chain_id
      WHERE h.hotel_id = :hotelId`,
    { hotelId: Number(hotelId) }
  );
  return result.rows[0] ? mapHotel(result.rows[0]) : null;
}

async function createHotel(chainId, { hotelCode, hotelName, status, createdBy }) {
  const result = await execute(
    `INSERT INTO opera_cfg_hotels
       (chain_id, hotel_code, hotel_name, status, created_by)
     VALUES
       (:chainId, :hotelCode, :hotelName, :status, :createdBy)
     RETURNING hotel_id INTO :hotelId`,
    {
      chainId: Number(chainId),
      hotelCode,
      hotelName,
      status,
      createdBy,
      hotelId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    },
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
    {
      chainId: Number(chainId),
      hotelId: Number(hotelId),
      hotelCode,
      hotelName,
      status,
      updatedBy
    },
    { autoCommit: true }
  );

  if (!result.rowsAffected) return null;
  return findById(hotelId);
}

module.exports = {
  findAll,
  findByChainId,
  findById,
  createHotel,
  updateHotel
};
