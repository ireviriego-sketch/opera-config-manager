(function () {
  'use strict';

  function ensureSidebarCss() {
    if (document.querySelector('link[data-sidebar-collapsible="true"]')) return;
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => String(link.href || '').includes('sidebar-collapsible.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/sidebar-collapsible.css';
    link.dataset.sidebarCollapsible = 'true';
    document.head.appendChild(link);
  }

  function safeApiFetch(path) {
    if (typeof apiFetch === 'function') return apiFetch(path);
    return fetch(path).then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.message || payload.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    });
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
      '/logs': 'admin-logs.html',
      '/admin-logs': 'admin-logs.html',
      '/admin-users': 'admin-users.html',
      '/admin-roles': 'admin-roles.html',
      '/admin-lovs': 'admin-lovs.html',
      '/general-admin': 'general-admin.html'
    };
    if (routeMap[clean]) return routeMap[clean] === '#' ? '#' : routeMap[clean] + query;
    if (clean.endsWith('.html')) return clean.replace(/^\//, '') + query;
    return clean.replace(/^\//, '') + '.html' + query;
  }

  function getItemId(item) { return item.NAV_ITEM_ID ?? item.navItemId ?? item.id ?? item.code ?? item.NAV_CODE; }
  function getParentId(item) { return item.PARENT_NAV_ITEM_ID ?? item.parentNavItemId ?? item.parentId ?? null; }
  function getDisplayOrder(item) { return Number(item.DISPLAY_ORDER ?? item.displayOrder ?? item.sortOrder ?? 0); }
  function getLabel(item) { return item.NAV_LABEL ?? item.navLabel ?? item.label ?? item.name ?? ''; }
  function getRoutePath(item) { return item.ROUTE_PATH ?? item.routePath ?? item.path ?? item.href ?? '#'; }
  function getIconName(item) { return String(item.ICON_NAME ?? item.iconName ?? item.icon ?? item.NAV_CODE ?? '').toLowerCase(); }
  function isActiveItem(item) { return (item.IS_ACTIVE ?? item.isActive ?? 'Y') !== 'N'; }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
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
    if (iconName.includes('logout') || label.includes('salir')) return '⎋';
    return '•';
  }

  function isActiveNavigation(routePath) {
    const target = normalizeRoute(routePath).split('?')[0];
    const current = window.location.pathname.split('/').pop() || 'index.html';
    if (target === current) return true;
    if (target === 'chains.html' && ['chain-detail.html'].includes(current)) return true;
    if (target === 'templates.html' && ['template-detail.html', 'version-detail.html', 'domain-detail.html', 'entity-detail.html', 'template-visual.html', 'model-canvas.html', 'model-canvas-2.html', 'model-canvas-editable.html', 'model-canvas-relationships.html'].includes(current)) return true;
    return false;
  }

  function sortNavigation(items) { return items.sort((a, b) => getDisplayOrder(a) - getDisplayOrder(b)); }

  function buildNavigationTree(items) {
    const activeItems = (items || []).filter(isActiveItem);
    const map = new Map();
    const roots = [];
    activeItems.forEach(item => {
      const id = getItemId(item);
      map.set(id, { ...item, children: Array.isArray(item.children) ? item.children : [] });
    });
    activeItems.forEach(item => {
      const id = getItemId(item);
      const parentId = getParentId(item);
      const node = map.get(id);
      if (parentId && map.has(parentId)) {
        const parent = map.get(parentId);
        const exists = parent.children.some(child => getItemId(child) === id);
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

  function fallbackNavigation() {
    return [
      { id: 'home', label: 'Inicio', path: 'index.html', icon: 'home', displayOrder: 10 },
      { id: 'templates', label: 'Plantillas', path: 'templates.html', icon: 'template', displayOrder: 20 },
      { id: 'chains', label: 'Cadenas', path: 'chains.html', icon: 'business', displayOrder: 30 },
      { id: 'hotels', label: 'Hoteles', path: 'hotels.html', icon: 'hotel', displayOrder: 40 },
      { id: 'imports', label: 'Importaciones', path: '#', icon: 'upload', displayOrder: 50 },
      { id: 'deployments', label: 'Despliegues OPERA', path: '#', icon: 'cloud', displayOrder: 60 },
      { id: 'admin', label: 'Administración', path: '#', icon: 'setting', displayOrder: 70, children: [
        { id: 'admin-users', label: 'Usuarios', path: 'admin-users.html', icon: 'user', displayOrder: 10 },
        { id: 'admin-roles', label: 'Roles', path: 'admin-roles.html', icon: 'role', displayOrder: 20 },
        { id: 'general-admin', label: 'General Administration', path: 'general-admin.html', icon: 'setting', displayOrder: 30 },
        { id: 'admin-lovs', label: 'LOVs', path: 'admin-lovs.html', icon: 'list', displayOrder: 40 },
        { id: 'admin-audit', label: 'Auditoría', path: 'admin-audit.html', icon: 'audit', displayOrder: 50 },
        { id: 'admin-logs', label: 'Logs', path: 'admin-logs.html', icon: 'log', displayOrder: 60 }
      ] }
    ];
  }

  function hasActiveChild(item) {
    return Array.isArray(item.children) && item.children.some(child => isActiveNavigation(getRoutePath(child)) || hasActiveChild(child));
  }

  function createMenuLink(item, level) {
    const target = normalizeRoute(getRoutePath(item));
    const active = isActiveNavigation(getRoutePath(item));
    const link = document.createElement('a');
    link.href = target;
    link.className = 'side-menu-link nav-link' + (active ? ' active' : '') + (target === '#' ? ' disabled' : '');
    link.title = getLabel(item);
    link.style.marginLeft = level > 0 ? level * 4 + 'px' : '';
    link.innerHTML = `<span class="nav-icon">${escapeHtml(iconFor(item))}</span><span class="nav-label">${escapeHtml(getLabel(item))}</span>`;
    if (target === '#') link.addEventListener('click', event => event.preventDefault());
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
    button.innerHTML = `<span class="nav-icon">${escapeHtml(iconFor(item))}</span><span class="nav-label">${escapeHtml(getLabel(item))}</span><span class="nav-caret">${isOpen ? '▾' : '▸'}</span>`;
    const children = document.createElement('div');
    children.className = 'side-menu-children nav-children';
    children.hidden = !isOpen;
    sortNavigation(item.children || []).forEach(child => children.appendChild(createMenuNode(child, level + 1)));
    button.addEventListener('click', () => {
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
    return Array.isArray(item.children) && item.children.length ? createParentMenuItem(item, level) : createMenuLink(item, level);
  }

  function getBottomActions(sidebar) {
    let actions = document.getElementById('sidebarBottomActions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'sidebarBottomActions';
      actions.className = 'sidebar-bottom-actions';
      sidebar.appendChild(actions);
    }
    return actions;
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
    button.addEventListener('click', () => setSidebarState(sidebar, !document.body.classList.contains('sidebar-pinned')));
    getBottomActions(sidebar).appendChild(button);
    return button;
  }

  function ensureSidebarLogoutButton(sidebar) {
    let button = document.getElementById('sidebarLogoutButton');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'sidebarLogoutButton';
    button.type = 'button';
    button.className = 'sidebar-logout-button';
    button.innerHTML = '<span class="nav-icon">⎋</span><span class="sidebar-logout-label">Salir</span>';
    button.addEventListener('click', () => {
      if (typeof clearToken === 'function') clearToken();
      else localStorage.removeItem('operaCfgToken');
      window.location.href = 'login.html';
    });
    getBottomActions(sidebar).appendChild(button);
    return button;
  }

  function setupCollapsibleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const menu = document.getElementById('sideMenu');
    if (!sidebar || !menu) return;
    document.body.classList.add('sidebar-ready');
    ensureSidebarPinButton(sidebar);
    ensureSidebarLogoutButton(sidebar);
    const pinned = localStorage.getItem('operaCfg.sidebarPinned') === 'Y';
    setSidebarState(sidebar, pinned);
    if (sidebar.dataset.collapsibleReady === 'Y') return;
    sidebar.dataset.collapsibleReady = 'Y';
    sidebar.addEventListener('mouseenter', () => { if (!document.body.classList.contains('sidebar-pinned')) sidebar.classList.add('sidebar-expanded'); });
    sidebar.addEventListener('mouseleave', () => { if (!document.body.classList.contains('sidebar-pinned')) sidebar.classList.remove('sidebar-expanded'); });
    sidebar.addEventListener('focusin', () => { if (!document.body.classList.contains('sidebar-pinned')) sidebar.classList.add('sidebar-expanded'); });
    sidebar.addEventListener('focusout', event => {
      if (!document.body.classList.contains('sidebar-pinned') && !sidebar.contains(event.relatedTarget)) sidebar.classList.remove('sidebar-expanded');
    });
  }

  async function loadSideMenu() {
    ensureSidebarCss();
    const menu = document.getElementById('sideMenu');
    if (!menu) return;
    try {
      const data = await safeApiFetch('/api/navigation');
      const tree = buildNavigationTree(data.items || []);
      menu.innerHTML = '';
      (tree.length ? tree : fallbackNavigation()).forEach(item => menu.appendChild(createMenuNode(item, 0)));
    } catch (error) {
      if (error.status === 401) {
        if (typeof clearToken === 'function') clearToken();
        window.location.href = 'login.html';
        return;
      }
      menu.innerHTML = '';
      fallbackNavigation().forEach(item => menu.appendChild(createMenuNode(item, 0)));
      console.warn('Using fallback navigation', error);
    } finally {
      setupCollapsibleSidebar();
    }
  }

  function setupBackButton() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    const current = window.location.pathname.split('/').pop() || 'index.html';
    const isHome = current === 'index.html' || current === '';
    btn.textContent = isHome ? 'Salir' : 'Volver';
    btn.classList.add('secondary');
    btn.addEventListener('click', event => {
      event.preventDefault();
      if (isHome) {
        if (typeof clearToken === 'function') clearToken();
        else localStorage.removeItem('operaCfgToken');
        window.location.href = 'login.html';
        return;
      }
      if (window.history.length > 1) window.history.back();
      else window.location.href = 'index.html';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSideMenu();
    setupBackButton();
  });
})();
