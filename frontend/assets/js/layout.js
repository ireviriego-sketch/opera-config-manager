const routeMap = {
  '/': 'index.html',
  '/templates': 'templates.html',
  '/chains': '#',
  '/hotels': '#',
  '/imports': '#',
  '/deployments': '#',
  '/audit': '#',
  '/logs': '#'
};

function normalizeRoute(routePath) {
  return routeMap[routePath] || routePath || '#';
}

function markActiveLink(anchor, target) {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  if (target === current) anchor.classList.add('active');
}

async function loadNavigation() {
  const sideMenu = document.getElementById('sideMenu');
  if (!sideMenu) return;

  try {
    const data = await apiFetch('/api/navigation');
    const items = data.items || [];

    sideMenu.innerHTML = '';

    items
      .filter(item => item.IS_MENU_ITEM === 'Y')
      .forEach(item => {
        const target = normalizeRoute(item.ROUTE_PATH);
        const anchor = document.createElement('a');
        anchor.href = target;
        anchor.textContent = item.NAV_LABEL;
        markActiveLink(anchor, target);
        sideMenu.appendChild(anchor);
      });
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = 'login.html';
      return;
    }
    sideMenu.innerHTML = '<span class="nav-error">No se pudo cargar el menú</span>';
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

function requireSession() {
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

requireSession();
setupLogout();
loadNavigation();
