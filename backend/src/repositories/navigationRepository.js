const { execute } = require('../db/query');

async function findActiveNavigation() {
  const result = await execute(
    `SELECT nav_item_id, parent_nav_item_id, nav_code, nav_label, route_path, icon_name,
            display_order, is_menu_item, is_home_tile, required_role_code
       FROM opera_cfg_nav_items
      WHERE is_active = 'Y'
      ORDER BY display_order, nav_label`
  );
  return result.rows;
}

module.exports = { findActiveNavigation };
