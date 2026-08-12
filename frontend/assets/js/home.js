function normalizeHomeRoute(routePath) {
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
    '/versions': 'templates.html',
    '/version-detail': 'version-detail.html',
    '/domains': 'templates.html',
    '/domain-detail': 'domain-detail.html',
    '/entities': 'templates.html',
    '/entity-detail': 'entity-detail.html',
    '/chains': 'chains.html',
    '/chain-detail': 'chain-detail.html',
    '/hotels': 'chains.html',
    '/imports': '#',
    '/deployments': '#',
    '/audit': '#',
    '/logs': '#'
  };

  if (routeMap[clean]) return routeMap[clean] === '#' ? '#' : routeMap[clean] + query;
  if (clean.endsWith('.html')) return clean.replace(/^\//, '') + query;

  return clean.replace(/^\//, '') + '.html' + query;
}

async function loadHomeTiles() {
  const tiles = document.getElementById('tiles');
  if (!tiles) return;

  try {
    const data = await apiFetch('/api/navigation');
    const items = data.items || [];

    tiles.innerHTML = items
      .filter(item => item.IS_HOME_TILE === 'Y')
      .map(item => {
        const target = normalizeHomeRoute(item.ROUTE_PATH);
        const disabledClass = target === '#' ? ' disabled' : '';
        return `
          <a class="dashboard-card${disabledClass}" href="${target}" ${target === '#' ? 'aria-disabled="true"' : ''}>
            <h3>${item.NAV_LABEL || ''}</h3>
            <p>${item.ROUTE_PATH || ''}</p>
          </a>
        `;
      })
      .join('');
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = 'login.html';
      return;
    }

    tiles.innerHTML = `
      <article class="dashboard-card">
        <h3>Error</h3>
        <p>No se ha podido cargar la navegación.</p>
      </article>
    `;
  }
}

loadHomeTiles();
