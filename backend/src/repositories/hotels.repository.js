const oracledb = require('oracledb');
const { execute } = require('../db/query');

function mapHotel(row) {
  return {
    hotelId: row.HOTEL_ID,
    chainId: row.CHAIN_ID,
    hotelCode: row.HOTEL_CODE,
    hotelName: row.HOTEL_NAME,
    status: row.STATUS,
    createdAt: row.CREATED_AT,
    createdBy: row.CREATED_BY,
    updatedAt: row.UPDATED_AT,
    updatedBy: row.UPDATED_BY
  };
}

async function findByChainId(chainId) {
  const result = await execute(
    `SELECT hotel_id,
            chain_id,
            hotel_code,
            hotel_name,
            status,
            created_at,
            created_by,
            updated_at,
            updated_by
       FROM opera_cfg_hotels
      WHERE chain_id = :chainId
      ORDER BY UPPER(hotel_name)`,
    { chainId: Number(chainId) }
  );
  return result.rows.map(mapHotel);
}

async function findById(hotelId) {
  const result = await execute(
    `SELECT hotel_id,
            chain_id,
            hotel_code,
            hotel_name,
            status,
            created_at,
            created_by,
            updated_at,
            updated_by
       FROM opera_cfg_hotels
      WHERE hotel_id = :hotelId`,
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
  findByChainId,
  findById,
  createHotel,
  updateHotel
};
