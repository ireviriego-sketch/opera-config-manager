(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const body = $('auditBody');
  let auditItems = [];


  const esc = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));


  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'An error occurred'); });

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

  async function loadAuditLovFilters() {
    if (!window.LovsClient) return;
    await Promise.all([
      window.LovsClient.populateSelect('#entityTypeFilter', 'AUDIT_ENTITY_TYPE', { emptyLabel: 'All' }),
      window.LovsClient.populateSelect('#actionFilter', 'AUDIT_ACTION', { emptyLabel: 'All' }),
      window.LovsClient.populateSelect('#resultStatusFilter', 'AUDIT_RESULT_STATUS', { emptyLabel: 'All' })
    ]);
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
      body.innerHTML = '<tr><td colspan="8">No audit events match the selected filters.</td></tr>';
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
        <td><button type="button" class="btn btn-secondary btn-sm" data-audit-detail="${index}">View</button></td>
      </tr>
    `).join('');
  }

  async function loadAudit() {
    try {
      body.innerHTML = '<tr><td colspan="8">Loading audit...</td></tr>';
      const payload = await requestJson(`/api/audit?${buildQuery()}`);
      auditItems = Array.isArray(payload?.items) ? payload.items : [];
      render(auditItems);
    } catch (error) {
      console.error('Error cargando auditoría', error);
      body.innerHTML = `<tr><td colspan="8">Unable to load audit. ${esc(error.message || '')}</td></tr>`;
    }
  }

  function pretty(value) {
    if (value === null || value === undefined || value === '') return '<span class="muted">No data</span>';
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
        <div><strong>Date</strong><span>${esc(item.eventTime || '-')}</span></div>
        <div><strong>User</strong><span>${esc(item.username || '-')}</span></div>
        <div><strong>Action</strong><span>${esc(item.action || '-')}</span></div>
        <div><strong>Status</strong><span>${esc(item.resultStatus || '-')}</span></div>
        <div><strong>Entity</strong><span>${esc(item.entityType || '-')}</span></div>
        <div><strong>ID</strong><span>${esc(item.entityId || '-')}</span></div>
        <div class="full"><strong>Name</strong><span>${esc(item.entityName || '-')}</span></div>
        <div class="full"><strong>Summary</strong><span>${esc(item.summary || '-')}</span></div>
      </div>
      <h3>Diff</h3>${pretty(item.changeDiff)}
      <h3>Before</h3>${pretty(item.oldValues)}
      <h3>After</h3>${pretty(item.newValues)}
      <h3>Details</h3>${pretty(item.details)}
      <h3>Technical Information</h3>${pretty({ ipAddress: item.ipAddress, userAgent: item.userAgent })}
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

  loadAuditLovFilters().finally(loadAudit);
})();
