const { getConnection } = require('./oraclePool');

async function execute(sql, binds = {}, options = {}) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, binds, options);
    return result;
  } finally {
    if (connection) await connection.close();
  }
}

async function executeTransaction(work) {
  let connection;
  try {
    connection = await getConnection();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = { execute, executeTransaction };
