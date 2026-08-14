(() => {
  const api = window.DeploymentContentApi;
  const PAGE_SIZE = 50;
  const state = {
    deploymentId: null,
    entityId: null,
    entity: null,
    attributes: [],
    records: [],
    filteredRecords: [],
    editingRecord: null,
    currentPage: 1,
    searchTerm: ''
  };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":"&#39;", '"':'&quot;' }[c]));
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; openModal('messageModal'); };
  const error = err => message('Error', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.deploymentId = params.get('deploymentId');
    state.entityId = params.get('entityId');

    if (!state.deploymentId || !state.entityId) {
      error('Faltan parámetros en la URL (deploymentId, entityId).');
      return;
    }

    $('backBtn').onclick = () => history.back();
    $('newRecordBtn').onclick = newRecord;
    $('closeRecordModalBtn').onclick = () => closeModal('recordModal');
    $('closeMessageBtn').onclick = () => closeModal('messageModal');
    $('recordForm').onsubmit = saveRecord;

    await loadEntity();
  }

  function openModal(id) { document.body.classList.add('modal-open'); show($(id)); }
  function closeModal(id) { hide($(id)); if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open'); }

  async function loadEntity() {
    try {
      const data = await api.getStructure(state.deploymentId);
      const structure = data.structure || [];

      for (const domain of structure) {
        const found = (domain.entities || []).find(e => String(e.deploymentEntityId) === String(state.entityId));
        if (found) {
          state.entity = found;
          $('entityTitle').textContent = found.entityName;
          $('entitySubtitle').textContent = domain.domainName;
          break;
        }
      }

      if (!state.entity) {
        error('No se encontró la entidad en la estructura del despliegue.');
        return;
      }

      state.attributes = (await api.getAttributes(state.deploymentId, state.entityId)).rows || [];
      state.records = (await api.listRecords(state.deploymentId, state.entityId)).rows || [];
      state.filteredRecords = state.records;
      state.currentPage = 1;

      
      renderSearchBar();
      renderRecords();
    } catch (err) { error(err); }
  }

  function attributeKey(attribute) {
    return attribute.attributeCode || attribute.attributeName || `ATTR_${attribute.deploymentAttributeId}`;
  }

  function renderAttributes() {
    $('attributesContainer').innerHTML = state.attributes.length
      ? state.attributes.map(attr => `
          <span class="attribute-pill" title="${escapeHtml(attr.dataType || '')}">
            ${escapeHtml(attributeKey(attr))}${attr.isRequired === 'Y' ? ' *' : ''}
          </span>
        `).join('')
      : '<p class="muted">Esta entidad no tiene atributos copiados.</p>';
  }

  function renderSearchBar() {
    const container = $('searchContainer');
    if (!container) return;
    container.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          id="searchInput"
          class="search-input"
          type="text"
          placeholder="Buscar en cualquier campo..."
          value="${escapeHtml(state.searchTerm)}"
          autocomplete="off"
        />
        <button id="searchClearBtn" class="search-clear ${state.searchTerm ? '' : 'hidden'}" type="button">✕</button>
      </div>
    `;

    $('searchInput').oninput = (e) => {
      state.searchTerm = e.target.value.trim().toLowerCase();
      state.currentPage = 1;
      applyFilter();
    };

    $('searchClearBtn').onclick = () => {
      state.searchTerm = '';
      state.currentPage = 1;
      applyFilter();
      renderSearchBar();
      $('searchInput').focus();
    };
  }

  function applyFilter() {
    if (!state.searchTerm) {
      state.filteredRecords = state.records;
    } else {
      state.filteredRecords = state.records.filter(record => {
        return Object.values(record.record || {}).some(val =>
          String(val ?? '').toLowerCase().includes(state.searchTerm)
        );
      });
    }
    // Mostrar/ocultar botón limpiar
    const clearBtn = $('searchClearBtn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !state.searchTerm);
    renderRecords();
  }

  function renderRecords() {
    const records = state.filteredRecords;

    if (!records.length) {
      $('recordsContainer').innerHTML = state.searchTerm
        ? `<p class="muted">No se encontraron registros para "<strong>${escapeHtml(state.searchTerm)}</strong>".</p>`
        : '<p class="muted">No hay registros para esta entidad. Pulsa Nuevo registro.</p>';
      return;
    }

    const totalPages = Math.ceil(records.length / PAGE_SIZE);
    const start = (state.currentPage - 1) * PAGE_SIZE;
    const pageRecords = records.slice(start, start + PAGE_SIZE);
    const columns = state.attributes.map(attributeKey);

    const cardsHtml = pageRecords.map(record => {
      const fields = columns.map(col => {
        const val = record.record?.[col] || '';
        if (!val) return '';
        // Resaltar coincidencia de búsqueda en el valor
        const displayVal = state.searchTerm
          ? escapeHtml(val).replace(new RegExp(`(${escapeHtml(state.searchTerm)})`, 'gi'), '<mark>$1</mark>')
          : escapeHtml(val);
        return `<div class="record-field">
          <span class="record-field-label">${escapeHtml(col)}</span>
          <span class="record-field-value">${displayVal}</span>
        </div>`;
      }).filter(Boolean).join('');

      return `<div class="record-card">
        <div class="record-card-fields">${fields}</div>
        <div class="record-card-actions">
          <button class="secondary small" data-edit-record="${record.deploymentRecordId}">Editar</button>
          <button class="secondary small danger" data-delete-record="${record.deploymentRecordId}">Borrar</button>
        </div>
      </div>`;
    }).join('');

    const totalLabel = state.searchTerm
      ? `${records.length} resultado${records.length !== 1 ? 's' : ''} para "<strong>${escapeHtml(state.searchTerm)}</strong>" · ${state.records.length} totales`
      : `${state.records.length} registros totales`;

    const paginationHtml = totalPages > 1 ? `
      <div class="pagination">
        <button class="pag-btn" id="pagPrev" ${state.currentPage === 1 ? 'disabled' : ''}>← Anterior</button>
        <div class="pag-pages">
          ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
            <button class="pag-btn pag-num ${p === state.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>
          `).join('')}
        </div>
        <button class="pag-btn" id="pagNext" ${state.currentPage === totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>` : '';

    $('recordsContainer').innerHTML = `
      <div class="records-summary">${totalLabel}${totalPages > 1 ? ` · Página ${state.currentPage} de ${totalPages}` : ''}</div>
      <div class="records-grid">${cardsHtml}</div>
      ${paginationHtml}
    `;

    // Eventos paginación
    document.querySelectorAll('[data-page]').forEach(btn =>
      btn.onclick = () => { state.currentPage = Number(btn.dataset.page); renderRecords(); window.scrollTo(0, 0); }
    );
    const prev = $('pagPrev');
    const next = $('pagNext');
    if (prev) prev.onclick = () => { state.currentPage--; renderRecords(); window.scrollTo(0, 0); };
    if (next) next.onclick = () => { state.currentPage++; renderRecords(); window.scrollTo(0, 0); };

    // Eventos editar/borrar
    document.querySelectorAll('[data-edit-record]').forEach(btn =>
      btn.onclick = () => editRecord(Number(btn.dataset.editRecord))
    );
    document.querySelectorAll('[data-delete-record]').forEach(btn =>
      btn.onclick = () => deleteRecord(Number(btn.dataset.deleteRecord))
    );
  }

  function newRecord() {
    state.editingRecord = null;
    renderRecordForm({});
    $('recordModalTitle').textContent = `Nuevo registro — ${state.entity.entityName}`;
    openModal('recordModal');
  }

  function editRecord(recordId) {
    const record = state.records.find(r => Number(r.deploymentRecordId) === recordId);
    if (!record) return;
    state.editingRecord = record;
    renderRecordForm(record.record || {});
    $('recordModalTitle').textContent = `Editar registro — ${state.entity.entityName}`;
    openModal('recordModal');
  }

  function renderRecordForm(values) {
    $('recordForm').innerHTML = state.attributes.map(attr => {
      const key = attributeKey(attr);
      return `<label>${escapeHtml(key)}${attr.isRequired === 'Y' ? ' *' : ''}
        <input class="input" data-record-field="${escapeHtml(key)}" value="${escapeHtml(values[key] || attr.defaultValue || '')}" />
      </label>`;
    }).join('') + '<div class="form-actions"><button class="primary" type="submit">Guardar registro</button></div>';
  }

  async function saveRecord(event) {
    event.preventDefault();
    const record = {};
    document.querySelectorAll('[data-record-field]').forEach(input => {
      record[input.dataset.recordField] = input.value.trim();
    });

    try {
      if (state.editingRecord) {
        await api.updateRecord(state.deploymentId, state.editingRecord.deploymentRecordId, record);
      } else {
        await api.createRecord(state.deploymentId, state.entity.deploymentEntityId, record);
      }
      closeModal('recordModal');
      state.records = (await api.listRecords(state.deploymentId, state.entityId)).rows || [];
      applyFilter();
    } catch (err) { error(err); }
  }

  async function deleteRecord(recordId) {
    if (!confirm('¿Borrar este registro?')) return;
    try {
      await api.deleteRecord(state.deploymentId, recordId);
      state.records = (await api.listRecords(state.deploymentId, state.entityId)).rows || [];
      applyFilter();
    } catch (err) { error(err); }
  }

})();
