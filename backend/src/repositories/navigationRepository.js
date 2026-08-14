const { execute } = require('../db/query');

async function findActiveNavigation(roleCodes = []) {
  const binds = {};
  const roleConditions = [];

  roleCodes.forEach((roleCode, index) => {
    const bindName = `role${index}`;
    binds[bindName] = roleCode;
    roleConditions.push(`required_role_code = :${bindName}`);
  });

  const roleFilter = roleConditions.length
    ? `AND (required_role_code IS NULL OR ${roleConditions.join(' OR ')})`
    : `AND required_role_code IS NULL`;

  const result = await execute(
    `SELECT
       nav_item_id,
       parent_nav_item_id,
       nav_code,
       nav_label,
       route_path,
       icon_name,
       display_order,
       is_menu_item,
       is_home_tile,
       required_role_code,
       is_active
     FROM opera_cfg_nav_items
     WHERE is_active = 'Y'
       AND is_menu_item = 'Y'
       ${roleFilter}
     ORDER BY NVL(parent_nav_item_id, nav_item_id), display_order, nav_label`,
    binds
  );

  return result.rows;
}

module.exports = { findActiveNavigation };
