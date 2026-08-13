(() => {
  const api = window.DeploymentContentApi;
  const state = { deploymentId: null, structure: [], selectedEntity: null, attributes: [], records: [], editingRecord: null };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; openModal('messageModal'); };
  const error = err => message('Error', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    state.deploymentId = new URLSearchParams(window.location.search).get('id');
    if (!state.deploymentId) { error('Falta id de despliegue en la URL.'); return; }
    $('backBtn').onclick = () => history.back();
    $('refreshBtn').onclick = loadStructure;
    // Crear botón nuevo registro dinámicamente
    const newRecordBtn = document.createElement('button');
    newRecordBtn.id = 'newRecordBtn';
    newRecordBtn.className = 'primary';
    newRecordBtn.type = 'button';
    newRecordBtn.textContent = 'Nuevo registro';
    newRecordBtn.onclick = newRecord;
    $('newRecordActions').appendChild(newRecordBtn);
    $('closeRecordModalBtn').onclick = () => closeModal('recordModal');
    $('closeMessageBtn').onclick = () => closeModal('messageModal');
    $('closeImportModalBtn').onclick = () => closeModal('importModal');
    $('recordForm').onsubmit = saveRecord;
    $('importForm').onsubmit = submitImport;
    await loadStructure();
  }

  function openModal(id) { document.body.classList.add('modal-open'); show($(id)); }
  function closeModal(id) { hide($(id)); if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open'); }

  async function loadStructure() {
    try {
      const data = await api.getStructure(state.deploymentId);
      state.structure = data.structure || [];
      renderStructure();
      if (!state.structure.length) {
        $('recordsContainer').innerHTML = '<p class="muted">Este despliegue todavía no tiene estructura copiada. Edita el despliegue y selecciona una versión origen.</p>';
      }
    } catch (err) { error(err); }
  }

  function renderStructure() {
    $('structureContainer').innerHTML = state.structure.length ? state.structure.map(domain => `
      <section class="domain-node">
        <div class="domain-header">
          <h3>${escapeHtml(domain.domainName)}</h3>
          <button class="secondary small import-domain-btn" data-domain-id="${domain.deploymentDomainId}" data-domain-name="${escapeHtml(domain.domainName)}">Importar</button>
        </div>
        <div class="entity-list">
          ${(domain.entities || []).map(entity => `
            <button class="entity-button" data-entity-id="${entity.deploymentEntityId}">
              <span>${escapeHtml(entity.entityName)}</span>
              <small>${Number(entity.recordCount || 0)} registros</small>
            </button>
          `).join('')}
        </div>
      </section>
    `).join('') : '<p class="muted">No hay dominios copiados para este despliegue.</p>';

    document.querySelectorAll('[data-entity-id]').forEach(button => button.onclick = () => selectEntity(Number(button.dataset.entityId)));
    document.querySelectorAll('.import-domain-btn').forEach(button => button.onclick = () => openImportModal(Number(button.dataset.domainId), button.dataset.domainName));
  }

  function findEntity(entityId) {
    for (const domain of state.structure) {
      const entity = (domain.entities || []).find(item => Number(item.deploymentEntityId) === Number(entityId));
      if (entity) return { domain, entity };
    }
    return null;
  }

  async function selectEntity(entityId) {
    const found = findEntity(entityId);
    if (!found) return;
    state.selectedEntity = found.entity;
    $('entityTitle').textContent = found.entity.entityName;
    $('entitySubtitle').textContent = found.domain.domainName;
    $('newRecordBtn') && ($('newRecordBtn').style.display = '');

    try {
      state.attributes = (await api.getAttributes(state.deploymentId, entityId)).rows || [];
      state.records = (await api.listRecords(state.deploymentId, entityId)).rows || [];
      renderAttributes();
      renderRecords();
    } catch (err) { error(err); }
  }

  function attributeKey(attribute) {
    return attribute.attributeCode || attribute.attributeName || `ATTR_${attribute.deploymentAttributeId}`;
  }

  function renderAttributes() {
    $('attributesContainer').innerHTML = state.attributes.length ? state.attributes.map(attr => `
      <span class="attribute-pill" title="${escapeHtml(attr.dataType || '')}">${escapeHtml(attributeKey(attr))}${attr.isRequired === 'Y' ? ' *' : ''}</span>
    `).join('') : '<p class="muted">Esta entidad no tiene atributos copiados.</p>';
  }

  function renderRecords() {
    if (!state.selectedEntity) return;
    if (!state.records.length) {
      $('recordsContainer').innerHTML = '<p class="muted">No hay registros para esta entidad. Pulsa Nuevo registro.</p>';
      return;
    }

    const columns = state.attributes.map(attributeKey);
    $('recordsContainer').innerHTML = `
      <table>
        <thead><tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${state.records.map(record => `
          <tr>${columns.map(col => `<td>${escapeHtml(record.record?.[col] || '')}</td>`).join('')}
          <td class="row-actions"><button class="secondary small" data-edit-record="${record.deploymentRecordId}">Editar</button><button class="secondary small danger" data-delete-record="${record.deploymentRecordId}">Borrar</button></td></tr>
        `).join('')}</tbody>
      </table>`;

    document.querySelectorAll('[data-edit-record]').forEach(button => button.onclick = () => editRecord(Number(button.dataset.editRecord)));
    document.querySelectorAll('[data-delete-record]').forEach(button => button.onclick = () => deleteRecord(Number(button.dataset.deleteRecord)));
  }

  function newRecord() {
    state.editingRecord = null;
    renderRecordForm({});
    $('recordModalTitle').textContent = `Nuevo registro - ${state.selectedEntity.entityName}`;
    openModal('recordModal');
  }

  function editRecord(recordId) {
    const record = state.records.find(item => Number(item.deploymentRecordId) === Number(recordId));
    if (!record) return;
    state.editingRecord = record;
    renderRecordForm(record.record || {});
    $('recordModalTitle').textContent = `Editar registro - ${state.selectedEntity.entityName}`;
    openModal('recordModal');
  }

  function renderRecordForm(values) {
    $('recordForm').innerHTML = state.attributes.map(attr => {
      const key = attributeKey(attr);
      return `<label>${escapeHtml(key)}${attr.isRequired === 'Y' ? ' *' : ''}<input class="input" data-record-field="${escapeHtml(key)}" value="${escapeHtml(values[key] || attr.defaultValue || '')}" /></label>`;
    }).join('') + '<div class="form-actions"><button class="primary" type="submit">Guardar registro</button></div>';
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!state.selectedEntity) return;

    const record = {};
    document.querySelectorAll('[data-record-field]').forEach(input => {
      record[input.dataset.recordField] = input.value.trim();
    });

    try {
      if (state.editingRecord) await api.updateRecord(state.deploymentId, state.editingRecord.deploymentRecordId, record);
      else await api.createRecord(state.deploymentId, state.selectedEntity.deploymentEntityId, record);
      closeModal('recordModal');
      state.records = (await api.listRecords(state.deploymentId, state.selectedEntity.deploymentEntityId)).rows || [];
      await loadStructure();
      renderRecords();
    } catch (err) { error(err); }
  }

  async function deleteRecord(recordId) {
    if (!confirm('¿Borrar este registro?')) return;
    try {
      await api.deleteRecord(state.deploymentId, recordId);
      state.records = (await api.listRecords(state.deploymentId, state.selectedEntity.deploymentEntityId)).rows || [];
      await loadStructure();
      renderRecords();
    } catch (err) { error(err); }
  }
  function openImportModal(domainId, domainName) {
    state.importDomainId = domainId;
    state.importDomainName = domainName;
    $('importModalTitle').textContent = `Importar Excel — ${domainName}`;
    $('importFileInput').value = '';
    $('importPreview').innerHTML = '';
    $('importStatus').textContent = '';
    openModal('importModal');
  }

  async function submitImport(event) {
    event.preventDefault();
    const file = $('importFileInput').files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    $('importStatus').innerHTML = '<span style="color:#6b46c1">⏳ Importando, espera...</span>';
    $('importSubmitBtn').disabled = true;
    $('importPreview').innerHTML = '';

    try {
      const response = await fetch(`/api/opera-config/deployment-content/${state.deploymentId}/domains/${state.importDomainId}/import`, {
        method: 'POST',
        body: formData
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) throw new Error(body.error || `HTTP ${response.status}`);

      $('importStatus').innerHTML = `<span style="color:#027a48">✅ ${body.inserted} registros insertados, ${body.skipped} omitidos.</span>`;

      let preview = '';
      if (body.processedSheets && body.processedSheets.length) {
        preview += `<p style="margin-top:12px;font-size:13px;font-weight:700">Entidades importadas:</p><ul style="font-size:13px;margin:4px 0 0 16px">${body.processedSheets.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
      }
      if (body.errors && body.errors.length) {
        preview += `<p style="margin-top:10px;font-size:13px;font-weight:700;color:#b54708">Avisos (${body.errors.length}):</p><ul style="font-size:12px;margin:4px 0 0 16px;color:#b54708">${body.errors.slice(0, 10).map(e => `<li>${escapeHtml(e)}</li>`).join('')}${body.errors.length > 10 ? `<li>...y ${body.errors.length - 10} más</li>` : ''}</ul>`;
      }
      $('importPreview').innerHTML = preview;
      await loadStructure();
    } catch (err) {
      $('importStatus').innerHTML = `<span style="color:#b42318">❌ Error: ${escapeHtml(err.message)}</span>`;
    } finally {
      $('importSubmitBtn').disabled = false;
    }
  }

})();
