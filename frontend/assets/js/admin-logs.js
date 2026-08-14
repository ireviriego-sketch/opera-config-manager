(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const body = $('logsBody');
  let logs = [];
  let levels = [];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

  function levelBadge(log) {
    const level = Number(log.levelNumber);
    const cls = level <= 0 ? 'log-level-critical' : level === 1 ? 'log-level-warning' : level === 2 ? 'log-level-info' : 'log-level-debug';
    return `<span class="log-level ${cls}">${esc(level)} · ${esc(log.levelName || '')}</span>`;
  }

  function populateLevels(config) {
    levels = config.levels || [];
    const levelSelect = $('logLevelSelect');
    const levelFilter = $('logsLevelFilter');
    levelSelect.innerHTML = '';
    levelFilter.innerHTML = '<option value="">Todos</option>';

    levels.forEach(level => {
      const opt = document.createElement('option');
      opt.value = String(level.value);
      opt.textContent = level.label;
      levelSelect.appendChild(opt);

      const filterOpt = document.createElement('option');
      filterOpt.value = String(level.value);
      filterOpt.textContent = `${level.value} · ${level.code}`;
      levelFilter.appendChild(filterOpt);
    });

    levelSelect.value = String(config.level ?? 1);
    updateHelpText();
  }

  function updateHelpText() {
    const selected = Number($('logLevelSelect')?.value || 1);
    const level = levels.find(item => Number(item.value) === selected);
    $('logLevelHelp').textContent = level ? level.label : `Nivel ${selected}`;
  }

  async function loadConfig() {
    const config = await requestJson('/api/logs/config');
    populateLevels(config);
  }

  function buildQuery() {
    const params = new URLSearchParams();
    const values = {
      q: $('logsSearch')?.value?.trim(),
      levelNumber: $('logsLevelFilter')?.value,
      source: $('logsSourceFilter')?.value?.trim(),
      eventCode: $('logsEventFilter')?.value?.trim(),
      fromDate: $('logsFromDate')?.value,
      toDate: $('logsToDate')?.value
    };
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set('limit', '250');
    return params.toString();
  }

  function render(items) {
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="7">No hay logs para los filtros seleccionados.</td></tr>';
      return;
    }

    body.innerHTML = items.map((log, index) => `
      <tr>
        <td>${esc(log.eventTime || '-')}</td>
        <td>${levelBadge(log)}</td>
        <td>${esc(log.source || '-')}</td>
        <td><strong>${esc(log.eventCode || '-')}</strong></td>
        <td class="log-message-cell">${esc(log.message || '-')}</td>
        <td>${esc(log.username || '-')}</td>
        <td><button type="button" class="btn btn-secondary btn-sm" data-log-detail="${index}">Ver</button></td>
      </tr>
    `).join('');
  }

  async function loadLogs() {
    try {
      body.innerHTML = '<tr><td colspan="7">Cargando logs...</td></tr>';
      const payload = await requestJson(`/api/logs?${buildQuery()}`);
      logs = Array.isArray(payload?.items) ? payload.items : [];
      render(logs);
    } catch (error) {
      console.error('Error cargando logs', error);
      body.innerHTML = `<tr><td colspan="7">No se han podido cargar logs. ${esc(error.message || '')}</td></tr>`;
    }
  }

  async function saveLogLevel() {
    const level = Number($('logLevelSelect').value);
    await requestJson('/api/logs/config', { method: 'PUT', body: JSON.stringify({ level }) });
    await loadConfig();
    await loadLogs();
  }

  function pretty(value) {
    if (value === null || value === undefined || value === '') return '<span class="muted">Sin datos</span>';
    if (typeof value === 'string') {
      try { return `<pre>${esc(JSON.stringify(JSON.parse(value), null, 2))}</pre>`; } catch { return `<pre>${esc(value)}</pre>`; }
    }
    return `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`;
  }

  function showDetail(index) {
    const log = logs[index];
    if (!log) return;
    $('logDetailContent').innerHTML = `
      <div class="log-detail-grid">
        <div><strong>Fecha</strong><span>${esc(log.eventTime || '-')}</span></div>
        <div><strong>Nivel</strong><span>${esc(log.levelNumber)} · ${esc(log.levelName)}</span></div>
        <div><strong>Source</strong><span>${esc(log.source || '-')}</span></div>
        <div><strong>Evento</strong><span>${esc(log.eventCode || '-')}</span></div>
        <div><strong>Usuario</strong><span>${esc(log.username || '-')}</span></div>
        <div><strong>IP</strong><span>${esc(log.ipAddress || '-')}</span></div>
        <div class="full"><strong>Mensaje</strong><span>${esc(log.message || '-')}</span></div>
      </div>
      <h3>Detalles</h3>${pretty(log.details)}
      <h3>Información técnica</h3>${pretty({ requestId: log.requestId, userAgent: log.userAgent })}
    `;
    $('logDetailModal').hidden = false;
  }

  document.addEventListener('click', event => {
    const detail = event.target.closest('[data-log-detail]');
    if (detail) showDetail(Number(detail.dataset.logDetail));
  });

  ['logsSearch', 'logsLevelFilter', 'logsSourceFilter', 'logsEventFilter', 'logsFromDate', 'logsToDate'].forEach(id => {
    $(id)?.addEventListener(id === 'logsSearch' ? 'input' : 'change', loadLogs);
  });

  $('logLevelSelect')?.addEventListener('change', updateHelpText);
  $('saveLogLevelBtn')?.addEventListener('click', saveLogLevel);
  $('refreshLogsBtn')?.addEventListener('click', loadLogs);
  $('closeLogModalBtn')?.addEventListener('click', () => { $('logDetailModal').hidden = true; });

  (async function init() {
    await loadConfig();
    await loadLogs();
  })();
})();
