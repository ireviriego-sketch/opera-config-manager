(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let lovs = [];
  let values = [];
  let parentValues = [];
  let selectedLov = null;
  let focusedLovId = null;
  let rowClickTimer = null;
  let editingLov = null;
  let editingValue = null;

  const esc = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  const showError = window.AppUtils?.showError || (error => { console.error(error); alert(error?.message || error || 'Se ha producido un error'); });

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

  function loadStatusOptions(){if(!window.LovsClient)return Promise.resolve();return Promise.all([window.LovsClient.populateSelect('#lovStatusInput','STATUS',{defaultValue:'ACTIVE'}),window.LovsClient.populateSelect('#valueStatusInput','STATUS',{defaultValue:'ACTIVE'})]);} function statusBadge(status) {
    const active = String(status || '').toUpperCase() === 'ACTIVE';
    return `<span class="lov-status ${active ? 'lov-status-active' : 'lov-status-inactive'}">${esc(status || '-')}</span>`;
  }

  function parentLovLabel(lov) {
    return lov?.parentLovCode ? `${lov.parentLovCode}` : '-';
  }

  function parentValueLabel(value) {
    return value?.parentValueCode ? `${value.parentValueCode}` : '-';
  }

  function updateLayoutState() {
    const layout = $('lovsLayout');
    const panel = $('lovValuesPanel');
    if (!layout || !panel) return;

    if (selectedLov) {
      layout.classList.remove('lovs-layout-empty');
      layout.classList.add('lovs-layout-selected');
      panel.hidden = false;
      window.setTimeout(() => panel.classList.add('panel-visible'), 0);
    } else {
      layout.classList.remove('lovs-layout-selected');
      layout.classList.add('lovs-layout-empty');
      panel.classList.remove('panel-visible');
      panel.hidden = true;
    }
  }

  function renderLovs() {
    const tbody = $('lovsBody');
    const search = $('lovSearch').value.trim().toLowerCase();
    const showInactive = $('showInactiveLovs').checked;
    const filtered = lovs.filter(lov => {
      if (!showInactive && lov.status !== 'ACTIVE') return false;
      if (!search) return true;
      return [lov.lovCode, lov.lovName, lov.description, lov.parentLovCode, lov.parentLovName]
        .some(value => String(value || '').toLowerCase().includes(search));
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6">No hay LOVs para los filtros seleccionados.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(lov => `
      <tr class="${((selectedLov && selectedLov.lovId === lov.lovId) || focusedLovId === lov.lovId) ? 'selected-row' : ''}" data-row-lov="${lov.lovId}">
        <td><strong>${esc(lov.lovCode)}</strong></td>
        <td>${esc(lov.lovName)}</td>
        <td>${esc(parentLovLabel(lov))}</td>
        <td>${statusBadge(lov.status)}</td>
        <td class="numeric-cell">${esc(lov.valueCount || 0)}</td>
        <td class="row-actions">
          <button class="btn btn-secondary btn-sm" data-edit-lov="${lov.lovId}">Editar</button>
          <button class="btn btn-danger btn-sm" data-delete-lov="${lov.lovId}">Desactivar</button>
        </td>
      </tr>
    `).join('');
  }

  async function loadParentValuesForSelectedLov() {
    parentValues = [];
    if (!selectedLov?.parentLovId) return;
    const payload = await requestJson(`/api/lovs/${selectedLov.parentLovId}/values?includeInactive=true`);
    parentValues = payload.items || [];
  }

  function populateParentFilter() {
    const label = $('parentValueFilterLabel');
    const filter = $('parentValueFilter');

    if (!selectedLov?.parentLovId) {
      label.hidden = true;
      filter.innerHTML = '<option value="">Todos</option>';
      return;
    }

    label.hidden = false;
    filter.innerHTML = '<option value="">Todos</option>' + parentValues
      .map(v => `<option value="${v.lovValueId}">${esc(v.valueCode)} - ${esc(v.valueLabel)}</option>`)
      .join('');
  }

  function renderValues() {
    const tbody = $('valuesBody');
    $('newValueBtn').disabled = !selectedLov;

    if (!selectedLov) {
      updateLayoutState();
      $('selectedLovTitle').textContent = 'Valores';
      $('selectedLovSubtitle').textContent = 'Selecciona una LOV para editar sus valores.';
      $('parentValueFilterLabel').hidden = true;
      tbody.innerHTML = '<tr><td colspan="6">No hay LOV seleccionada.</td></tr>';
      return;
    }

    updateLayoutState();
    $('selectedLovTitle').textContent = `Valores de ${selectedLov.lovCode}`;
    $('selectedLovSubtitle').textContent = selectedLov.parentLovCode
      ? `${selectedLov.lovName} · depende de ${selectedLov.parentLovCode}`
      : selectedLov.lovName || '';

    const showInactive = $('showInactiveValues').checked;
    const parentFilter = selectedLov.parentLovId ? $('parentValueFilter').value : '';
    const filtered = values.filter(value => {
      if (!showInactive && value.status !== 'ACTIVE') return false;
      if (parentFilter && String(value.parentLovValueId || '') !== String(parentFilter)) return false;
      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6">Esta LOV no tiene valores para el filtro seleccionado.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(value => `
      <tr>
        <td><strong>${esc(value.valueCode)}</strong></td>
        <td>${esc(value.valueLabel)}</td>
        <td>${esc(parentValueLabel(value))}</td>
        <td class="numeric-cell">${esc(value.sortOrder)}</td>
        <td>${statusBadge(value.status)}</td>
        <td class="row-actions">
          <button class="btn btn-secondary btn-sm" data-edit-value="${value.lovValueId}">Editar</button>
          <button class="btn btn-danger btn-sm" data-delete-value="${value.lovValueId}">Desactivar</button>
        </td>
      </tr>
    `).join('');
  }

  async function loadLovs(keepSelection = true) {
    const payload = await requestJson('/api/lovs?includeInactive=true');
    lovs = payload.items || [];
    if (keepSelection && selectedLov) selectedLov = lovs.find(lov => lov.lovId === selectedLov.lovId) || null;
    renderLovs();
  }

  async function selectLov(lovId) {
    selectedLov = lovs.find(lov => lov.lovId === Number(lovId)) || null;
    focusedLovId = selectedLov ? selectedLov.lovId : null;
    values = [];
    parentValues = [];
    renderLovs();
    if (!selectedLov) return renderValues();
    await loadParentValuesForSelectedLov();
    populateParentFilter();
    const payload = await requestJson(`/api/lovs/${selectedLov.lovId}/values?includeInactive=true`);
    values = payload.items || [];
    renderValues();
  }

  function populateParentLovSelect(currentLovId = null, selectedParentId = null) {
    const select = $('lovParentInput');
    select.innerHTML = '<option value="">Sin dependencia</option>' + lovs
      .filter(lov => !currentLovId || lov.lovId !== Number(currentLovId))
      .map(lov => `<option value="${lov.lovId}">${esc(lov.lovCode)} - ${esc(lov.lovName)}</option>`)
      .join('');
    select.value = selectedParentId ? String(selectedParentId) : '';
  }

  function openLovModal(lov = null) {
    editingLov = lov;
    $('lovModalTitle').textContent = lov ? `Editar LOV ${lov.lovCode}` : 'Nueva LOV';
    $('lovCodeInput').value = lov?.lovCode || '';
    $('lovNameInput').value = lov?.lovName || '';
    $('lovDescriptionInput').value = lov?.description || '';
    $('lovStatusInput').value = lov?.status || 'ACTIVE';
    populateParentLovSelect(lov?.lovId, lov?.parentLovId);
    $('lovFormMessage').textContent = '';
    $('lovModal').hidden = false;
    $('lovCodeInput').focus();
  }

  function closeLovModal() {
    $('lovModal').hidden = true;
    editingLov = null;
  }

  async function saveLov() {
    const message = $('lovFormMessage');
    message.textContent = '';
    const payload = {
      lovCode: $('lovCodeInput').value.trim(),
      lovName: $('lovNameInput').value.trim(),
      description: $('lovDescriptionInput').value.trim(),
      status: $('lovStatusInput').value,
      parentLovId: $('lovParentInput').value || null
    };
    if (!payload.lovCode || !payload.lovName) {
      message.textContent = 'Código y nombre son obligatorios.';
      return;
    }

    try {
      if (editingLov) await requestJson(`/api/lovs/${editingLov.lovId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await requestJson('/api/lovs', { method: 'POST', body: JSON.stringify(payload) });
      closeLovModal();
      await loadLovs(true);
      if (selectedLov) await selectLov(selectedLov.lovId);
    } catch (error) {
      message.textContent = error.message || 'No se ha podido guardar la LOV.';
    }
  }

  function populateParentValueSelect(selectedParentValueId = null) {
    const box = $('valueParentBox');
    const select = $('valueParentInput');
    if (!selectedLov?.parentLovId) {
      box.hidden = true;
      select.innerHTML = '<option value="">Sin padre</option>';
      return;
    }
    box.hidden = false;
    select.innerHTML = '<option value="">Sin padre</option>' + parentValues
      .map(v => `<option value="${v.lovValueId}">${esc(v.valueCode)} - ${esc(v.valueLabel)}</option>`)
      .join('');
    select.value = selectedParentValueId ? String(selectedParentValueId) : '';
  }

  function openValueModal(value = null) {
    if (!selectedLov) return;
    editingValue = value;
    $('valueModalTitle').textContent = value ? `Editar valor ${value.valueCode}` : `Nuevo valor en ${selectedLov.lovCode}`;
    $('valueCodeInput').value = value?.valueCode || '';
    $('valueLabelInput').value = value?.valueLabel || '';
    $('valueSortInput').value = value?.sortOrder || 10;
    $('valueStatusInput').value = value?.status || 'ACTIVE';
    populateParentValueSelect(value?.parentLovValueId);
    $('valueFormMessage').textContent = '';
    $('valueModal').hidden = false;
    $('valueCodeInput').focus();
  }

  function closeValueModal() {
    $('valueModal').hidden = true;
    editingValue = null;
  }

  async function saveValue() {
    const message = $('valueFormMessage');
    message.textContent = '';
    const payload = {
      valueCode: $('valueCodeInput').value.trim(),
      valueLabel: $('valueLabelInput').value.trim(),
      sortOrder: Number($('valueSortInput').value || 10),
      status: $('valueStatusInput').value,
      parentLovValueId: $('valueParentInput').value || null
    };
    if (!payload.valueCode || !payload.valueLabel) {
      message.textContent = 'Código y etiqueta son obligatorios.';
      return;
    }

    try {
      if (editingValue) await requestJson(`/api/lovs/${selectedLov.lovId}/values/${editingValue.lovValueId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await requestJson(`/api/lovs/${selectedLov.lovId}/values`, { method: 'POST', body: JSON.stringify(payload) });
      closeValueModal();
      await selectLov(selectedLov.lovId);
      await loadLovs(true);
    } catch (error) {
      message.textContent = error.message || 'No se ha podido guardar el valor.';
    }
  }

  async function deactivateLov(lovId) {
    await requestJson(`/api/lovs/${lovId}`, { method: 'DELETE' });
    if (selectedLov && selectedLov.lovId === Number(lovId)) {
      selectedLov = null;
      values = [];
      parentValues = [];
    }
    await loadLovs(false);
    populateParentFilter();
    renderValues();
  }

  async function deactivateValue(lovValueId) {
    await requestJson(`/api/lovs/${selectedLov.lovId}/values/${lovValueId}`, { method: 'DELETE' });
    await selectLov(selectedLov.lovId);
    await loadLovs(true);
  }

  function focusLovOnly(lovId) {
    focusedLovId = Number(lovId);
    selectedLov = null;
    values = [];
    parentValues = [];
    renderLovs();
    populateParentFilter();
    renderValues();
  }

  function scheduleLovFocus(lovId) {
    if (rowClickTimer) window.clearTimeout(rowClickTimer);
    rowClickTimer = window.setTimeout(() => {
      rowClickTimer = null;
      focusLovOnly(lovId);
    }, 220);
  }

  function openLovValues(lovId) {
    if (rowClickTimer) {
      window.clearTimeout(rowClickTimer);
      rowClickTimer = null;
    }
    return selectLov(lovId);
  }

  document.addEventListener('click', async event => {
    const editLovBtn = event.target.closest('[data-edit-lov]');
    const deleteLovBtn = event.target.closest('[data-delete-lov]');
    const editValueBtn = event.target.closest('[data-edit-value]');
    const deleteValueBtn = event.target.closest('[data-delete-value]');
    const rowLov = event.target.closest('[data-row-lov]');

    if (editLovBtn) return openLovModal(lovs.find(lov => lov.lovId === Number(editLovBtn.dataset.editLov)));
    if (deleteLovBtn) return deactivateLov(deleteLovBtn.dataset.deleteLov);
    if (editValueBtn) return openValueModal(values.find(value => value.lovValueId === Number(editValueBtn.dataset.editValue)));
    if (deleteValueBtn) return deactivateValue(deleteValueBtn.dataset.deleteValue);
    if (rowLov && !event.target.closest('button')) return scheduleLovFocus(rowLov.dataset.rowLov);
  });

  document.addEventListener('dblclick', event => {
    const rowLov = event.target.closest('[data-row-lov]');
    if (rowLov && !event.target.closest('button')) return openLovValues(rowLov.dataset.rowLov);
  });

  $('newLovBtn').addEventListener('click', () => openLovModal());
  $('newValueBtn').addEventListener('click', () => openValueModal());
  $('saveLovBtn').addEventListener('click', saveLov);
  $('cancelLovBtn').addEventListener('click', closeLovModal);
  $('closeLovModalBtn').addEventListener('click', closeLovModal);
  $('saveValueBtn').addEventListener('click', saveValue);
  $('cancelValueBtn').addEventListener('click', closeValueModal);
  $('closeValueModalBtn').addEventListener('click', closeValueModal);
  $('lovSearch').addEventListener('input', renderLovs);
  $('showInactiveLovs').addEventListener('change', renderLovs);
  $('showInactiveValues').addEventListener('change', renderValues);
  $('parentValueFilter').addEventListener('change', renderValues);

  loadStatusOptions().finally(() => loadLovs(false).then(renderValues)).catch(error => {
    $('lovsBody').innerHTML = `<tr><td colspan="6">No se han podido cargar LOVs. ${esc(error.message || '')}</td></tr>`;
  });
})();
