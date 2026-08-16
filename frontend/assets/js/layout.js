function ensureSidebarCss() {
  if (document.querySelector('link[data-sidebar-collapsible="true"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/css/sidebar-collapsible.css';
  link.dataset.sidebarCollapsible = 'true';
  document.head.appendChild(link);
}
function normalizeRoute(routePath) {
  const raw = String(routePath || '').trim();
  if (!raw || raw === '#') return '#';
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.split('?')[0].replace(/\/+$/, '') || '/';
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  const routeMap = {
    '/': 'index.html',
    '/home': 'index.html',
    '/templates': 'templates.html',
    '/template-detail': 'template-detail.html',
    '/template-versions': 'templates.html',
    '/version-detail': 'version-detail.html',
    '/domains': 'templates.html',
    '/domain-detail': 'domain-detail.html',
    '/entities': 'templates.html',
    '/entity-detail': 'entity-detail.html',
    '/chains': 'chains.html',
    '/chain-detail': 'chain-detail.html',
    '/hotels': 'hotels.html',
    '/imports': '#',
    '/deployments': '#',
    '/audit': 'admin-audit.html',
    '/admin-audit': 'admin-audit.html',
    '/logs': '#',
    '/admin-users': 'admin-users.html',
    '/admin-roles': 'admin-roles.html',
    '/admin-lovs': 'admin-lovs.html',
    '/general-admin': 'general-admin.html'
  };
  if (routeMap[clean]) return routeMap[clean] === '#' ? '#' : routeMap[clean] + query;
  if (clean.endsWith('.html')) return clean.replace(/^\//, '') + query;
  return clean.replace(/^\//, '') + '.html' + query;
}
function getItemId(item) {
  return item.NAV_ITEM_ID ?? item.navItemId ?? item.id;
}
function getParentId(item) {
  return item.PARENT_NAV_ITEM_ID ?? item.parentNavItemId ?? item.parentId ?? null;
}
function getDisplayOrder(item) {
  return Number(item.DISPLAY_ORDER ?? item.displayOrder ?? item.sortOrder ?? 0);
}
function getLabel(item) {
  return item.NAV_LABEL ?? item.navLabel ?? item.label ?? item.name ?? '';
}
function getRoutePath(item) {
  return item.ROUTE_PATH ?? item.routePath ?? item.path ?? item.href ?? '#';
}
function getIconName(item) {
  return String(item.ICON_NAME ?? item.iconName ?? item.icon ?? item.NAV_CODE ?? '').toLowerCase();
}
function isActiveItem(item) {
  return (item.IS_ACTIVE ?? item.isActive ?? 'Y') !== 'N';
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (char) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char];
  });
}
function iconFor(item) {
  const iconName = getIconName(item);
  const label = getLabel(item).toLowerCase();
  if (iconName.includes('home') || label.includes('inicio')) return '🏠';
  if (iconName.includes('template') || label.includes('plantilla')) return '⚙️';
  if (iconName.includes('business') || label.includes('cadena')) return '🏢';
  if (iconName.includes('hotel') || label.includes('hotel')) return '🏨';
  if (iconName.includes('upload') || label.includes('import')) return '📤';
  if (iconName.includes('cloud') || label.includes('despliegue')) return '☁️';
  if (iconName.includes('audit') || iconName.includes('history') || label.includes('auditor')) return '📋';
  if (iconName.includes('log') || iconName.includes('error') || label.includes('log')) return '📜';
  if (iconName.includes('user') || label.includes('usuario')) return '👤';
  if (iconName.includes('role') || label.includes('rol')) return '•';
  if (iconName.includes('list') || label.includes('lov')) return '📄';
  if (iconName.includes('setting') || label.includes('administr')) return '⚙️';
  return '•';
}
function isActiveNavigation(routePath) {
  const target = normalizeRoute(routePath).split('?')[0];
  const current = window.location.pathname.split('/').pop() || 'index.html';
  if (target === current) return true;
  if (target === 'chains.html' && current === 'chain-detail.html') return true;
  if (target === 'templates.html' && ['template-detail.html', 'version-detail.html', 'domain-detail.html', 'entity-detail.html'].includes(current)) return true;
  if (target === 'admin-users.html' && current === 'admin-users.html') return true;
  if (target === 'admin-roles.html' && current === 'admin-roles.html') return true;
  if (target === 'admin-lovs.html' && current === 'admin-lovs.html') return true;
  if (target === 'admin-audit.html' && current === 'admin-audit.html') return true;
  if (target === 'general-admin.html' && current === 'general-admin.html') return true;
  return false;
}
function sortNavigation(items) {
  return items.sort(function (a, b) {
    return getDisplayOrder(a) - getDisplayOrder(b);
  });
}
function buildNavigationTree(items) {
  const activeItems = (items || []).filter(isActiveItem);
  const map = new Map();
  const roots = [];
  activeItems.forEach(function (item) {
    const id = getItemId(item);
    map.set(id, { ...item, children: Array.isArray(item.children) ? item.children : [] });
  });
  activeItems.forEach(function (item) {
    const id = getItemId(item);
    const parentId = getParentId(item);
    const node = map.get(id);
    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId);
      const exists = parent.children.some(function (child) { return getItemId(child) === id; });
      if (!exists) parent.children.push(node);
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
function hasActiveChild(item) {
  return Array.isArray(item.children) && item.children.some(function (child) {
    return isActiveNavigation(getRoutePath(child)) || hasActiveChild(child);
  });
}
function createMenuLink(item, level) {
  const target = normalizeRoute(getRoutePath(item));
  const active = isActiveNavigation(getRoutePath(item));
  const link = document.createElement('a');
  link.href = target;
  link.className = 'side-menu-link nav-link' + (active ? ' active' : '') + (target === '#' ? ' disabled' : '');
  link.title = getLabel(item);
  link.style.marginLeft = level > 0 ? level * 4 + 'px' : '';
  link.innerHTML = '<span class="nav-icon">' + escapeHtml(iconFor(item)) + '</span><span class="nav-label">' + escapeHtml(getLabel(item)) + '</span>';
  if (target === '#') {
    link.addEventListener('click', function (event) { event.preventDefault(); });
  }
  return link;
}
function createParentMenuItem(item, level) {
  const isOpen = hasActiveChild(item);
  const wrapper = document.createElement('div');
  wrapper.className = 'side-menu-group nav-group' + (isOpen ? ' open active' : '');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'side-menu-link nav-link nav-parent' + (isOpen ? ' active' : '');
  button.title = getLabel(item);
  button.setAttribute('aria-expanded', String(isOpen));
  button.style.marginLeft = level > 0 ? level * 4 + 'px' : '';
  button.innerHTML = '<span class="nav-icon">' + escapeHtml(iconFor(item)) + '</span><span class="nav-label">' + escapeHtml(getLabel(item)) + '</span><span class="nav-caret">' + (isOpen ? '▾' : '▸') + '</span>';
  const children = document.createElement('div');
  children.className = 'side-menu-children nav-children';
  children.hidden = !isOpen;
  sortNavigation(item.children || []).forEach(function (child) {
    children.appendChild(createMenuNode(child, level + 1));
  });
  button.addEventListener('click', function () {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    children.hidden = expanded;
    const caret = button.querySelector('.nav-caret');
    if (caret) caret.textContent = expanded ? '▸' : '▾';
    wrapper.classList.toggle('open', !expanded);
  });
  wrapper.appendChild(button);
  wrapper.appendChild(children);
  return wrapper;
}
function createMenuNode(item, level) {
  if (Array.isArray(item.children) && item.children.length > 0) return createParentMenuItem(item, level);
  return createMenuLink(item, level);
}
function updateSidebarPinButton(pinned) {
  const pinButton = document.getElementById('sidebarPinButton');
  if (!pinButton) return;
  pinButton.setAttribute('aria-pressed', String(pinned));
  const icon = pinButton.querySelector('.nav-icon');
  const label = pinButton.querySelector('.sidebar-pin-label');
  if (icon) icon.textContent = pinned ? '📌' : '📍';
  if (label) label.textContent = pinned ? 'Unpin menu' : 'Pin menu';
}
function setSidebarState(sidebar, pinned) {
  document.body.classList.add('sidebar-ready');
  document.body.classList.toggle('sidebar-pinned', pinned);
  sidebar.classList.toggle('sidebar-expanded', pinned);
  localStorage.setItem('operaCfg.sidebarPinned', pinned ? 'Y' : 'N');
  updateSidebarPinButton(pinned);
}
function ensureSidebarPinButton(sidebar) {
  let button = document.getElementById('sidebarPinButton');
  if (button) return button;
  button = document.createElement('button');
  button.id = 'sidebarPinButton';
  button.type = 'button';
  button.className = 'sidebar-pin-button';
  button.innerHTML = '<span class="nav-icon">📍</span><span class="sidebar-pin-label">Pin menu</span>';
  button.addEventListener('click', function () {
    const shouldPin = !document.body.classList.contains('sidebar-pinned');
    setSidebarState(sidebar, shouldPin);
  });
  sidebar.appendChild(button);
  return button;
}
function setupCollapsibleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const menu = document.getElementById('sideMenu');
  if (!sidebar || !menu) return;
  document.body.classList.add('sidebar-ready');
  ensureSidebarPinButton(sidebar);
  const pinned = localStorage.getItem('operaCfg.sidebarPinned') === 'Y';
  setSidebarState(sidebar, pinned);
  sidebar.addEventListener('mouseenter', function () {
    if (!document.body.classList.contains('sidebar-pinned')) sidebar.classList.add('sidebar-expanded');
  });
  sidebar.addEventListener('mouseleave', function () {
    if (!document.body.classList.contains('sidebar-pinned')) sidebar.classList.remove('sidebar-expanded');
  });
  sidebar.addEventListener('focusin', function () {
    if (!document.body.classList.contains('sidebar-pinned')) sidebar.classList.add('sidebar-expanded');
  });
  sidebar.addEventListener('focusout', function (event) {
    if (!document.body.classList.contains('sidebar-pinned') && !sidebar.contains(event.relatedTarget)) {
      sidebar.classList.remove('sidebar-expanded');
    }
  });
}
async function loadSideMenu() {
  ensureSidebarCss();
  const menu = document.getElementById('sideMenu');
  if (!menu) return;
  try {
    const data = await apiFetch('/api/navigation');
    const tree = buildNavigationTree(data.items || []);
    menu.innerHTML = '';
    tree.forEach(function (item) { menu.appendChild(createMenuNode(item, 0)); });
    setupCollapsibleSidebar();
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = 'login.html';
      return;
    }
    menu.innerHTML = 'Error cargando menu';
    setupCollapsibleSidebar();
  }
}
function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', function () {
    clearToken();
    window.location.href = 'login.html';
  });
}
loadSideMenu();
setupLogout();
