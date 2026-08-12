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
    '/audit': '#',
    '/logs': '#'
  };

  if (routeMap[clean]) return routeMap[clean] === '#' ? '#' : routeMap[clean] + query;
  if (clean.endsWith('.html')) return clean.replace(/^\//, '') + query;
  return clean.replace(/^\//, '') + '.html' + query;
}

function isActiveNavigation(routePath) {
  const target = normalizeRoute(routePath).split('?')[0];
  const current = window.location.pathname.split('/').pop() || 'index.html';

  if (target === current) return true;
  if (target === 'chains.html' && current === 'chain-detail.html') return true;
  if (target === 'templates.html' && ['template-detail.html', 'version-detail.html', 'domain-detail.html', 'entity-detail.html'].includes(current)) return true;
  return false;
}

async function loadSideMenu() {
  const menu = document.getElementById('sideMenu');
  if (!menu) return;

  try {
    const data = await apiFetch('/api/navigation');
    const items = data.items || [];

    menu.innerHTML = items
      .filter(item => item.IS_ACTIVE !== 'N')
      .map(item => {
        const target = normalizeRoute(item.ROUTE_PATH);
        const active = isActiveNavigation(item.ROUTE_PATH) ? ' active' : '';
        const disabled = target === '#' ? ' disabled' : '';
        return `<a class="side-menu-link${active}${disabled}" href="${target}" ${target === '#' ? 'aria-disabled="true"' : ''}>${item.NAV_LABEL || ''}</a>`;
      })
      .join('');
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = 'login.html';
      return;
    }
    menu.innerHTML = '<span class="side-menu-error">Error cargando menú</span>';
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', () => {
    clearToken();
    window.location.href = 'login.html';
  });
}

loadSideMenu();
setupLogout();
