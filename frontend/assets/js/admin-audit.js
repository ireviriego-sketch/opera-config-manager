(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const body = $('auditBody');
  let auditItems = [];

  const EXTRA_ACTIONS = [
    'CREATE_DEPLOYMENT_RECORD', 'UPDATE_DEPLOYMENT_RECORD', 'DELETE_DEPLOYMENT_RECORD',
    'DELETE_DEPLOYMENT_ENTITY_RECORDS', 'IMPORT_DEPLOYMENT_DOMAIN_EXCEL',
    'CREATE_CHAIN', 'UPDATE_CHAIN', 'DELETE_CHAIN',
    'CREATE_HOTEL', 'UPDATE_HOTEL', 'DELETE_HOTEL', 'IMPORT_HOTELS',
    'CREATE_TEMPLATE', 'UPDATE_TEMPLATE',
    'CREATE_VERSION', 'UPDATE_VERSION', 'ACTIVATE_VERSION',
    'CREATE_RELATIONSHIP', 'UPDATE_RELATIONSHIP', 'DELETE_RELATIONSHIP',
    'CREATE_USER', 'ASSIGN_ROLE', 'ASSIGN_SCOPE', 'RESET_PASSWORD'
  ];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function ensureActionOptions() {
    const select = $('actionFilter');
    if (!select) return;
    const existing = new Set(Array.from(select.options).map(option => option.value));
    EXTRA_ACTIONS.forEach(action => {
      if (!existing.has(action)) {
        const option = document.createElement('option');
        option.value = action;
        option.textContent = action;
        select.appendChild(option);
      }
    });
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

  function buildQuery() {
    const params = new URLSearchParams();
    const values = {
      q: $('auditSearch')?.value?.trim(),
      entityType: $('entityTypeFilter')?.value,
      action: $('actionFilter')?.value,
      resultStatus: $('resultStatusFilter')?.value,
      fromDate: $('fromDateFilter')?.value,
      toDate: $('toDateFilter')?.value
    };
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set('limit', '200');
    return params.toString();
  }

  function statusBadge(status) {
    const normalized = String(status || '').toUpperCase();
    const cls = normalized === 'SUCCESS' ? 'audit-status-success' : normalized === 'FAILED' ? 'audit-status-failed' : 'audit-status-warning';
    return `<span class="audit-status ${cls}">${esc(normalized || '-')}</span>`;
  }

  function render(items) {
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="8">No hay eventos de auditoría para los filtros seleccionados.</td></tr>';
      return;
    }

    body.innerHTML = items.map((item, index) => `
      <tr>
        <td>${esc(item.eventTime || '-')}</td>
        <td>${esc(item.username || '-')}</td>
        <td><strong>${esc(item.action || '-')}</strong></td>
        <td>${statusBadge(item.resultStatus)}</td>
        <td>${esc(item.entityType || '-')}</td>
        <td>${esc(item.entityName || item.entityId || '-')}</td>
        <td>${esc(item.summary || '-')}</td>
        <td><button type="button" class="btn btn-secondary btn-sm" data-audit-detail="${index}">Ver</button></td>
      </tr>
    `).join('');
  }

  async function loadAudit() {
    try {
      body.innerHTML = '<tr><td colspan="8">Cargando auditoría...</td></tr>';
      const payload = await requestJson(`/api/audit?${buildQuery()}`);
      auditItems = Array.isArray(payload?.items) ? payload.items : [];
      render(auditItems);
    } catch (error) {
      console.error('Error cargando auditoría', error);
      body.innerHTML = `<tr><td colspan="8">No se ha podido cargar auditoría. ${esc(error.message || '')}</td></tr>`;
    }
  }

  function pretty(value) {
    if (value === null || value === undefined || value === '') return '<span class="muted">Sin datos</span>';
    if (typeof value === 'string') {
      try { return `<pre>${esc(JSON.stringify(JSON.parse(value), null, 2))}</pre>`; } catch { return `<pre>${esc(value)}</pre>`; }
    }
    return `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`;
  }

  function showDetail(index) {
    const item = auditItems[index];
    if (!item) return;
    $('auditDetailContent').innerHTML = `
      <div class="audit-detail-grid">
        <div><strong>Fecha</strong><span>${esc(item.eventTime || '-')}</span></div>
        <div><strong>Usuario</strong><span>${esc(item.username || '-')}</span></div>
        <div><strong>Acción</strong><span>${esc(item.action || '-')}</span></div>
        <div><strong>Estado</strong><span>${esc(item.resultStatus || '-')}</span></div>
        <div><strong>Entidad</strong><span>${esc(item.entityType || '-')}</span></div>
        <div><strong>ID</strong><span>${esc(item.entityId || '-')}</span></div>
        <div class="full"><strong>Nombre</strong><span>${esc(item.entityName || '-')}</span></div>
        <div class="full"><strong>Resumen</strong><span>${esc(item.summary || '-')}</span></div>
      </div>
      <h3>Diff</h3>${pretty(item.changeDiff)}
      <h3>Antes</h3>${pretty(item.oldValues)}
      <h3>Después</h3>${pretty(item.newValues)}
      <h3>Detalles</h3>${pretty(item.details)}
      <h3>Información técnica</h3>${pretty({ ipAddress: item.ipAddress, userAgent: item.userAgent })}
    `;
    $('auditDetailModal').hidden = false;
  }

  document.addEventListener('click', event => {
    const detail = event.target.closest('[data-audit-detail]');
    if (detail) showDetail(Number(detail.dataset.auditDetail));
  });

  ['auditSearch', 'entityTypeFilter', 'actionFilter', 'resultStatusFilter', 'fromDateFilter', 'toDateFilter'].forEach(id => {
    $(id)?.addEventListener(id === 'auditSearch' ? 'input' : 'change', loadAudit);
  });

  $('refreshAuditBtn')?.addEventListener('click', loadAudit);
  $('closeAuditModalBtn')?.addEventListener('click', () => { $('auditDetailModal').hidden = true; });

  ensureActionOptions();
  loadAudit();
})();
