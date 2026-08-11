const { execute } = require('../db/query');

async function findByUsername(username) {
  const result = await execute(
    `SELECT user_id, username, password_hash, full_name, email, status, failed_login_count, locked_until
       FROM opera_cfg_users
      WHERE UPPER(username) = UPPER(:username)`,
    { username }
  );
  return result.rows[0] || null;
}

async function findRolesByUserId(userId) {
  const result = await execute(
    `SELECT r.role_code, r.role_name
       FROM opera_cfg_user_roles ur
       JOIN opera_cfg_roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = :userId
      ORDER BY r.role_code`,
    { userId }
  );
  return result.rows;
}

module.exports = { findByUsername, findRolesByUserId };
