(function () {
  'use strict';

  const ROUTE_MAP = {
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
    '/audit': 'admin-audit.html',
    '/admin-audit': 'admin-audit.html',
    '/logs': 'admin-logs.html',
    '/admin-logs': 'admin-logs.html',
    '/admin-users': 'admin-users.html',
    '/admin-roles': 'admin-roles.html',
    '/admin-lovs': 'admin-lovs.html',
    '/general-admin': 'general-admin.html'
  };

  function toHtmlRoute(routePath) {
    const raw = String(routePath || '').trim();
    if (!raw || raw === '#') return '#';
    if (/^https?:\/\//i.test(raw)) return raw;
    const clean = raw.split('?')[0].replace(/\/+$/, '') || '/';
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
    if (ROUTE_MAP[clean]) return ROUTE_MAP[clean] === '#' ? '#' : ROUTE_MAP[clean] + query;
    if (clean.endsWith('.html')) return clean.replace(/^\//, '') + query;
    return clean.replace(/^\//, '') + '.html' + query;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function isHiddenHomeItem(item) {
    const label = String(item.label || item.NAV_LABEL || item.navLabel || '').trim().toLowerCase();
    const route = String(item.path || item.ROUTE_PATH || item.routePath || '').trim().toLowerCase();
    return route === '/imports'
      || route === '/deployments'
      || route === 'imports.html'
      || route === 'deployments.html'
      || label === 'imports'
      || label === 'opera deployments'
      || label === 'importaciones'
      || label === 'despliegues opera';
  }

  function translateHomeText(value) {
    const text = String(value || '').trim();
    const normalized = text.toLowerCase();
    const map = {
      'inicio': 'Home',
      'plantillas': 'Templates',
      'cadenas': 'Chains',
      'hoteles': 'Hotels',
      'importaciones': 'Imports',
      'despliegues opera': 'OPERA Deployments',
      'gestión de modelos de configuración opera cloud': 'Management of OPERA Cloud configuration models',
      'gestión de cadenas hoteleras y hoteles': 'Management of hotel chains and hotels',
      'gestión de hoteles': 'Management of hotels',
      'configuración general de la aplicación': 'General application settings',
      'listas de valores configurables': 'Configurable value lists'
    };
    return map[normalized] || text;
  }

  function fallbackHomeItems() {
    return [
      { label: 'Templates', path: 'templates.html', description: 'Management of OPERA Cloud configuration models' },
      { label: 'Chains', path: 'chains.html', description: 'Management of hotel chains and hotels' },
      { label: 'Hotels', path: 'hotels.html', description: 'Management of hotels' },
      { label: 'LOVs', path: 'admin-lovs.html', description: 'Configurable value lists' },
      { label: 'General Administration', path: 'general-admin.html', description: 'General application settings' }
    ];
  }

  function renderHomeTiles(items) {
    const tiles = document.getElementById('tiles');
    if (!tiles) return;
    tiles.innerHTML = items.map(item => {
      const target = toHtmlRoute(item.path || item.ROUTE_PATH || item.routePath || '#');
      const label = translateHomeText(item.label || item.NAV_LABEL || item.navLabel || '');
      const description = translateHomeText(item.description || item.DESCRIPTION || item.descriptionText || item.ROUTE_PATH || item.routePath || item.path || '');
      return `
        <a class="dashboard-card${target === '#' ? ' disabled' : ''}" href="${esc(target)}" ${target === '#' ? 'aria-disabled="true"' : ''}>
          <h3>${esc(label)}</h3>
          <p>${esc(description)}</p>
        </a>
      `;
    }).join('');
  }

  async function loadHomeTiles() {
    const tiles = document.getElementById('tiles');
    if (!tiles) return;

    try {
      const data = typeof apiFetch === 'function' ? await apiFetch(apiPath('/navigation')) : { items: [] };
      const items = (data.items || [])
        .filter(item => (item.IS_HOME_TILE === 'Y' || item.isHomeTile === 'Y') && !isHiddenHomeItem(item))
        .map(item => ({
          label: item.NAV_LABEL || item.navLabel || item.label,
          path: item.ROUTE_PATH || item.routePath || item.path,
          description: item.DESCRIPTION || item.description || item.ROUTE_PATH || item.routePath || item.path
        }));
      renderHomeTiles(items.length ? items : fallbackHomeItems());
    } catch (error) {
      if (error.status === 401) {
        if (typeof clearToken === 'function') clearToken();
        window.location.href = 'login.html';
        return;
      }
      renderHomeTiles(fallbackHomeItems());
    }
  }

  document.addEventListener('DOMContentLoaded', loadHomeTiles);
})();
