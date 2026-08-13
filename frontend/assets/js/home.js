async function loadHomeTiles() {
  const tiles = document.getElementById('tiles');
  if (!tiles) return;

  try {
    const data = await apiFetch('/api/navigation');
    const items = data.items || [];

    tiles.innerHTML = items
      .filter(item => item.IS_HOME_TILE === 'Y')
      .map(item => {
        const target = normalizeRoute(item.ROUTE_PATH);
        return `
          <a class="dashboard-card${target === '#' ? ' disabled' : ''}" href="${target}" ${target === '#' ? 'aria-disabled="true"' : ''}>
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
