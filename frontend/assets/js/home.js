async function loadHome() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return;
  }

  const sideMenu = document.getElementById('sideMenu');
  const tiles = document.getElementById('tiles');

  try {
    const data = await apiFetch('/api/navigation');
    const items = data.items || [];

    sideMenu.innerHTML = items
      .filter(item => item.IS_MENU_ITEM === 'Y')
      .map(item => `<a href="${item.ROUTE_PATH || '#'}">${item.NAV_LABEL}</a>`)
      .join('');

    tiles.innerHTML = items
      .filter(item => item.IS_HOME_TILE === 'Y')
      .map(item => `<article class="tile"><h3>${item.NAV_LABEL}</h3><p>${item.ROUTE_PATH || ''}</p></article>`)
      .join('');
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = 'login.html';
      return;
    }
    tiles.innerHTML = '<article class="tile"><h3>Error</h3><p>No se ha podido cargar la navegación.</p></article>';
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearToken();
  window.location.href = 'login.html';
});

loadHome();
