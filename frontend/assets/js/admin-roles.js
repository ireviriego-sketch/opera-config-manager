(function () {
  'use strict';

  const body = document.getElementById('rolesBody');
  const search = document.getElementById('roleSearch');
  const refreshBtn = document.getElementById('refreshRolesBtn');
  let roles = [];

  const esc = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'An error occurred'); });

  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.roles)) return payload.roles;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  const requestJson = window.AppUtils?.requestJson || (async function requestJson(url, options = {}) {
    const token = localStorage.getItem('operaCfgToken') || localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || '';
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
    if (!response.ok) throw new Error(payload?.message || payload?.error || text || `HTTP ${response.status}`);
    return payload;
  });

  function roleValue(role, camel, upper, fallback = '') {
    return role?.[camel] ?? role?.[upper] ?? fallback;
  }

  function render(rows) {
    if (!body) return;

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7">No roles to display.</td></tr>';
      return;
    }

    body.innerHTML = rows.map(role => {
      const roleCode = roleValue(role, 'roleCode', 'ROLE_CODE');
      const roleName = roleValue(role, 'roleName', 'ROLE_NAME');
      const roleDescription = roleValue(role, 'roleDescription', 'ROLE_DESCRIPTION', '-');
      const isSystemRole = roleValue(role, 'isSystemRole', 'IS_SYSTEM_ROLE', 'N');
      const userCount = roleValue(role, 'userCount', 'USER_COUNT', 0);
      const permissionCount = roleValue(role, 'permissionCount', 'PERMISSION_COUNT', 0);
      const updatedAt = roleValue(role, 'updatedAt', 'UPDATED_AT', '-') || roleValue(role, 'createdAt', 'CREATED_AT', '-');

      return `
        <tr>
          <td><strong>${esc(roleCode)}</strong></td>
          <td>${esc(roleName)}</td>
          <td>${esc(roleDescription || '-')}</td>
          <td>${esc(isSystemRole || 'N')}</td>
          <td>${esc(userCount ?? 0)}</td>
          <td>${esc(permissionCount ?? 0)}</td>
          <td>${esc(updatedAt || '-')}</td>
        </tr>
      `;
    }).join('');
  }

  function applyFilter() {
    const q = String(search?.value || '').trim().toLowerCase();
    if (!q) {
      render(roles);
      return;
    }
    render(roles.filter(role => JSON.stringify(role).toLowerCase().includes(q)));
  }

  async function loadRoles() {
    try {
      if (body) body.innerHTML = '<tr><td colspan="7">Loading roles...</td></tr>';
      const payload = await requestJson(apiPath('/admin/roles'));
      roles = normalizeList(payload);
      render(roles);
    } catch (error) {
      console.error('Error cargando roles', error);
      if (body) body.innerHTML = `<tr><td colspan="7">Unable to load roles. ${esc(error.message || '')}</td></tr>`;
    }
  }

  search?.addEventListener('input', applyFilter);
  refreshBtn?.addEventListener('click', loadRoles);
  loadRoles();
})();
