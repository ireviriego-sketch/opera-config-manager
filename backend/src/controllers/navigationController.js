const navigationRepository = require('../repositories/navigationRepository');
const { getRequestRoles } = require('../middleware/requireRole');

function getItemId(item) {
  return item.NAV_ITEM_ID ?? item.navItemId ?? item.nav_item_id;
}

function getParentId(item) {
  return item.PARENT_NAV_ITEM_ID ?? item.parentNavItemId ?? item.parent_nav_item_id ?? null;
}

function getDisplayOrder(item) {
  return Number(item.DISPLAY_ORDER ?? item.displayOrder ?? item.display_order ?? 0);
}

function sortNavigation(items) {
  return items.sort((a, b) => getDisplayOrder(a) - getDisplayOrder(b));
}

function buildTree(items) {
  const map = new Map();
  const roots = [];

  (items || []).forEach((item) => {
    const id = getItemId(item);
    map.set(id, { ...item, children: [] });
  });

  (items || []).forEach((item) => {
    const id = getItemId(item);
    const parentId = getParentId(item);
    const node = map.get(id);

    if (parentId && map.has(parentId)) {
      map.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  roots.forEach(function sortChildren(node) {
    if (Array.isArray(node.children) && node.children.length) {
      node.children = sortNavigation(node.children);
      node.children.forEach(sortChildren);
    }
  });

  return sortNavigation(roots);
}

async function list(req, res, next) {
  try {
    const roleCodes = await getRequestRoles(req);
    const items = await navigationRepository.findActiveNavigation(roleCodes);
    res.json({ items: buildTree(items) });
  } catch (error) {
    next(error);
  }
}

module.exports = { list };
