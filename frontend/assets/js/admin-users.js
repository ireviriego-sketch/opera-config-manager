(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const body = $('usersBody');
  const detailPanel = $('userDetailPanel');
  let users = [];
  let roles = [];
  let chains = [];
  let hotels = [];
  let userDetail = null;
  let currentUserId = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pick(row, camel, upper, fallback = '') {
    return row?.[camel] ?? row?.[upper] ?? fallback;
  }

  function list(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (key && Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function item(payload, key) {
    return payload?.item || (key ? payload?.[key] : null) || payload;
  }

  async function requestJson(url, options = {}) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || '';
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
  }

  function ensureToastContainer() {
    let container = $('appToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'appToastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'success') {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 20);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
  }

  function roleBadges(roleCodes) {
    if (!roleCodes) return '-';
    return String(roleCodes).split(',').map(r => r.trim()).filter(Boolean).map(r => `<span class="badge">${esc(r)}</span>`).join(' ');
  }

  function accessSummary(user) {
    const chainCount = Number(pick(user, 'chainPermissionCount', 'CHAIN_PERMISSION_COUNT', 0));
    const hotelCount = Number(pick(user, 'hotelPermissionCount', 'HOTEL_PERMISSION_COUNT', 0));
    const globalCount = Number(pick(user, 'globalPermissionCount', 'GLOBAL_PERMISSION_COUNT', 0));
    const parts = [];
    if (chainCount) parts.push(`${chainCount} cadenas`);
    if (hotelCount) parts.push(`${hotelCount} hoteles`);
    if (globalCount) parts.push(`${globalCount} globales`);
    return parts.length ? parts.join(' · ') : 'Sin permisos';
  }

  function renderUsers(rows) {
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8">No hay usuarios para mostrar.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(u => {
      const userId = pick(u, 'userId', 'USER_ID');
      return `
        <tr>
          <td><strong>${esc(pick(u, 'username', 'USERNAME'))}</strong></td>
          <td>${esc(pick(u, 'fullName', 'FULL_NAME', '-'))}</td>
          <td>${esc(pick(u, 'email', 'EMAIL', '-'))}</td>
          <td>${esc(pick(u, 'status', 'STATUS', '-'))}</td>
          <td>${roleBadges(pick(u, 'roleCodes', 'ROLE_CODES', ''))}</td>
          <td>${esc(accessSummary(u))}</td>
          <td>${esc(pick(u, 'lastLoginAt', 'LAST_LOGIN_AT', '-'))}</td>
          <td class="user-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-edit-user="${esc(userId)}">Editar acceso</button>
            <button type="button" class="btn btn-secondary btn-sm" data-reset-user="${esc(userId)}">Reset password</button>
          </td>
        </tr>`;
    }).join('');
  }

  async function loadUsers() {
    body.innerHTML = '<tr><td colspan="8">Cargando usuarios...</td></tr>';
    const payload = await requestJson('/api/admin/users');
    users = list(payload, 'users');
    renderUsers(users);
  }

  async function loadCatalogs() {
    const [rolesPayload, chainsPayload, hotelsPayload] = await Promise.all([
      requestJson('/api/admin/roles'), requestJson('/api/admin/chains'), requestJson('/api/admin/hotels')
    ]);
    roles = list(rolesPayload, 'roles');
    chains = list(chainsPayload, 'chains');
    hotels = list(hotelsPayload, 'hotels');
  }

  function selectedRoleCodes() {
    const checkedIds = new Set(Array.from(document.querySelectorAll('#rolesChecklist input:checked')).map(input => Number(input.value)));
    return new Set(roles.filter(role => checkedIds.has(Number(pick(role, 'roleId', 'ROLE_ID')))).map(role => pick(role, 'roleCode', 'ROLE_CODE')));
  }

  function hasSelectedRole(roleCode) { return selectedRoleCodes().has(roleCode); }

  function activateTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.hidden = true);
    const button = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    const panel = $('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (button && panel && !button.hidden) { button.classList.add('active'); panel.hidden = false; }
  }

  function updateRoleDependentTabs() {
    const showChains = hasSelectedRole('CHAIN_MANAGER');
    const showHotels = hasSelectedRole('HOTEL_MANAGER');
    const chainTab = document.querySelector('.tab-button[data-tab="chains"]');
    const hotelTab = document.querySelector('.tab-button[data-tab="hotels"]');
    if (chainTab) chainTab.hidden = !showChains;
    if (hotelTab) hotelTab.hidden = !showHotels;
    if ($('tabChains') && !showChains) $('tabChains').hidden = true;
    if ($('tabHotels') && !showHotels) $('tabHotels').hidden = true;
    const activeButton = document.querySelector('.tab-button.active');
    if (!activeButton || activeButton.hidden) activateTab('roles');
    const warning = $('roleAccessWarning');
    if (warning) warning.hidden = showChains || showHotels;
  }

  function renderRoles() {
    const selectedRoleIds = new Set((userDetail.roles || []).map(r => Number(pick(r, 'roleId', 'ROLE_ID'))));
    $('rolesChecklist').innerHTML = `
      <div id="roleAccessWarning" class="access-warning">Para ver la asignación de cadenas u hoteles, marca primero CHAIN_MANAGER u HOTEL_MANAGER.</div>
      ${roles.map(role => {
        const roleId = pick(role, 'roleId', 'ROLE_ID');
        const roleCode = pick(role, 'roleCode', 'ROLE_CODE');
        const roleName = pick(role, 'roleName', 'ROLE_NAME', '');
        return `<label class="check-row"><input type="checkbox" value="${esc(roleId)}" ${selectedRoleIds.has(Number(roleId)) ? 'checked' : ''}><strong>${esc(roleCode)}</strong><span>${esc(roleName)}</span></label>`;
      }).join('')}`;
    $('rolesChecklist').querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', updateRoleDependentTabs));
    updateRoleDependentTabs();
  }

  function assignedIds(scopeType) {
    return new Set((userDetail.permissions || []).filter(p => pick(p, 'scopeType', 'SCOPE_TYPE') === scopeType).map(p => Number(scopeType === 'CHAIN' ? pick(p, 'chainId', 'CHAIN_ID') : pick(p, 'hotelId', 'HOTEL_ID'))));
  }

  function roleIdByCode(code) { return Number(pick(roles.find(r => pick(r, 'roleCode', 'ROLE_CODE') === code), 'roleId', 'ROLE_ID', 0)); }

  function renderChains(filter = '') {
    const selected = assignedIds('CHAIN'); const q = filter.trim().toLowerCase();
    $('chainsChecklist').innerHTML = chains.filter(c => !q || JSON.stringify(c).toLowerCase().includes(q)).map(chain => {
      const id = Number(pick(chain, 'chainId', 'CHAIN_ID'));
      const name = pick(chain, 'chainName', 'CHAIN_NAME') || pick(chain, 'chainCode', 'CHAIN_CODE');
      const code = pick(chain, 'chainCode', 'CHAIN_CODE', id);
      return `<label class="access-check-card"><input type="checkbox" value="${esc(id)}" ${selected.has(id) ? 'checked' : ''}><strong>${esc(name)}</strong><span class="access-check-meta">${esc(code)}</span></label>`;
    }).join('');
  }

  function renderHotels(filter = '') {
    const selected = assignedIds('HOTEL'); const q = filter.trim().toLowerCase();
    $('hotelsChecklist').innerHTML = hotels.filter(h => !q || JSON.stringify(h).toLowerCase().includes(q)).map(hotel => {
      const id = Number(pick(hotel, 'hotelId', 'HOTEL_ID'));
      const name = pick(hotel, 'hotelName', 'HOTEL_NAME') || pick(hotel, 'hotelCode', 'HOTEL_CODE');
      const code = pick(hotel, 'hotelCode', 'HOTEL_CODE', id);
      const chain = pick(hotel, 'chainName', 'CHAIN_NAME', '');
      return `<label class="access-check-card"><input type="checkbox" value="${esc(id)}" ${selected.has(id) ? 'checked' : ''}><strong>${esc(name)}</strong><span class="access-check-meta">${esc(chain ? chain + ' · ' : '')}${esc(code)}</span></label>`;
    }).join('');
  }

  function renderPermissions() {
    const permissions = userDetail.permissions || [];
    if (!permissions.length) { $('permissionsList').innerHTML = '<p>No hay permisos técnicos asignados.</p>'; return; }
    $('permissionsList').innerHTML = permissions.map(p => {
      const role = pick(p, 'roleCode', 'ROLE_CODE'); const scope = pick(p, 'scopeType', 'SCOPE_TYPE');
      const name = pick(p, 'chainName', 'CHAIN_NAME') || pick(p, 'hotelName', 'HOTEL_NAME') || 'GLOBAL';
      const readOnly = pick(p, 'isReadOnly', 'IS_READ_ONLY', 'N');
      return `<div class="permission-row"><strong>${esc(role)}</strong><span>${esc(scope)}</span><span>${esc(name)}</span><span>${readOnly === 'Y' ? 'Solo lectura' : 'Edición'}</span></div>`;
    }).join('');
  }

  async function openUser(userId) {
    currentUserId = Number(userId); await loadCatalogs();
    const payload = await requestJson(`/api/admin/users/${currentUserId}`); userDetail = item(payload, 'user');
    $('userDetailTitle').textContent = `Detalle de ${pick(userDetail, 'username', 'USERNAME')}`;
    $('detailUsername').value = pick(userDetail, 'username', 'USERNAME', '');
    $('detailFullName').value = pick(userDetail, 'fullName', 'FULL_NAME', '');
    $('detailEmail').value = pick(userDetail, 'email', 'EMAIL', '');
    $('detailStatus').value = pick(userDetail, 'status', 'STATUS', '');
    renderRoles(); renderChains(); renderHotels(); renderPermissions();
    detailPanel.hidden = false; activateTab('roles'); detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveRoles() {
    const roleIds = Array.from(document.querySelectorAll('#rolesChecklist input:checked')).map(input => Number(input.value));
    await requestJson(`/api/admin/users/${currentUserId}/roles`, { method: 'PUT', body: JSON.stringify({ roleIds }) });
    await loadUsers(); await openUser(currentUserId); showToast('Roles actualizados correctamente');
  }

  async function saveScope(scopeType, checklistId, roleCode, readOnlyId) {
    if (scopeType === 'CHAIN' && !hasSelectedRole('CHAIN_MANAGER')) return alert('Marca primero el rol CHAIN_MANAGER.');
    if (scopeType === 'HOTEL' && !hasSelectedRole('HOTEL_MANAGER')) return alert('Marca primero el rol HOTEL_MANAGER.');
    const ids = Array.from(document.querySelectorAll(`#${checklistId} input:checked`)).map(input => Number(input.value));
    const roleId = roleIdByCode(roleCode); if (!roleId) return alert(`No existe el rol ${roleCode}.`);
    const url = scopeType === 'CHAIN' ? `/api/admin/users/${currentUserId}/permissions/chains` : `/api/admin/users/${currentUserId}/permissions/hotels`;
    const payload = scopeType === 'CHAIN' ? { roleId, chainIds: ids, isReadOnly: $(readOnlyId).checked ? 'Y' : 'N' } : { roleId, hotelIds: ids, isReadOnly: $(readOnlyId).checked ? 'Y' : 'N' };
    await requestJson(url, { method: 'PUT', body: JSON.stringify(payload) });
    await loadUsers(); await openUser(currentUserId); showToast(scopeType === 'CHAIN' ? 'Cadenas autorizadas actualizadas correctamente' : 'Hoteles autorizados actualizados correctamente');
  }

  function ensureCreateUserModal() {
    if ($('createUserModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="createUserModal" class="admin-modal hidden">
        <div class="admin-modal-card">
          <div class="admin-modal-header"><h2>Nuevo usuario</h2><button id="closeCreateUserModal" type="button" class="modal-close">Cerrar</button></div>
          <form id="createUserForm" class="form-grid">
            <label>Usuario<input id="newUsername" class="form-control" required></label>
            <label>Nombre<input id="newFullName" class="form-control"></label>
            <label>Email<input id="newEmail" class="form-control" type="email"></label>
            <label>Estado<select id="newStatus" class="form-control"><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
            <div class="full-row"><h3>Roles iniciales</h3><div id="newUserRolesChecklist" class="check-list"></div></div>
            <div class="actions-row full-row"><button type="submit" class="btn btn-primary">Crear usuario y copiar enlace</button></div>
          </form>
        </div>
      </div>`);
    $('closeCreateUserModal').onclick = () => $('createUserModal').classList.add('hidden');
    $('createUserForm').onsubmit = createUser;
  }

  async function openCreateUser() {
    await loadCatalogs(); ensureCreateUserModal();
    $('newUserRolesChecklist').innerHTML = roles.map(role => `<label class="check-row"><input type="checkbox" value="${esc(pick(role, 'roleId', 'ROLE_ID'))}"><strong>${esc(pick(role, 'roleCode', 'ROLE_CODE'))}</strong><span>${esc(pick(role, 'roleName', 'ROLE_NAME', ''))}</span></label>`).join('');
    $('newUsername').value = ''; $('newFullName').value = ''; $('newEmail').value = ''; $('newStatus').value = 'ACTIVE';
    $('createUserModal').classList.remove('hidden');
  }

  async function createUser(event) {
    event.preventDefault();
    const roleIds = Array.from(document.querySelectorAll('#newUserRolesChecklist input:checked')).map(input => Number(input.value));
    const payload = { username: $('newUsername').value.trim(), fullName: $('newFullName').value.trim(), email: $('newEmail').value.trim(), status: $('newStatus').value, roleIds };
    const response = await requestJson('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    $('createUserModal').classList.add('hidden');
    await copyText(response.resetUrl);
    await loadUsers(); showToast('Usuario creado. Enlace de contraseña copiado al portapapeles');
  }

  async function resetPassword(userId) {
    const response = await requestJson(`/api/admin/users/${userId}/password-reset`, { method: 'POST', body: JSON.stringify({}) });
    await copyText(response.resetUrl);
    showToast('Enlace de reseteo copiado al portapapeles');
  }

  document.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-user]'); if (edit) openUser(edit.dataset.editUser).catch(error => alert(error.message));
    const reset = event.target.closest('[data-reset-user]'); if (reset) resetPassword(reset.dataset.resetUser).catch(error => alert(error.message));
  });

  document.querySelectorAll('.tab-button').forEach(button => button.addEventListener('click', () => { if (!button.hidden) activateTab(button.dataset.tab); }));
  $('userSearch')?.addEventListener('input', () => { const q = $('userSearch').value.trim().toLowerCase(); renderUsers(q ? users.filter(u => JSON.stringify(u).toLowerCase().includes(q)) : users); });
  $('chainSearch')?.addEventListener('input', () => renderChains($('chainSearch').value));
  $('hotelSearch')?.addEventListener('input', () => renderHotels($('hotelSearch').value));
  $('closeUserDetailBtn')?.addEventListener('click', () => detailPanel.hidden = true);
  $('saveRolesBtn')?.addEventListener('click', () => saveRoles().catch(error => alert(error.message)));
  $('saveChainsBtn')?.addEventListener('click', () => saveScope('CHAIN', 'chainsChecklist', 'CHAIN_MANAGER', 'chainsReadOnly').catch(error => alert(error.message)));
  $('saveHotelsBtn')?.addEventListener('click', () => saveScope('HOTEL', 'hotelsChecklist', 'HOTEL_MANAGER', 'hotelsReadOnly').catch(error => alert(error.message)));
  $('newUserBtn')?.addEventListener('click', () => openCreateUser().catch(error => alert(error.message)));

  loadUsers().catch(error => { console.error(error); body.innerHTML = `<tr><td colspan="8">No se han podido cargar los usuarios. ${esc(error.message)}</td></tr>`; });
})();
