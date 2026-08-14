(() => {
  const api = window.DeploymentContentApi;
  const state = {
    deploymentId: null,
    entityId: null,
    entity: null,
    attributes: [],
    records: [],
    editingRecord: null
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
      // Cargamos la estructura completa para encontrar el nombre de la entidad y dominio
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

      renderAttributes();
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

  function renderRecords() {
    if (!state.records.length) {
      $('recordsContainer').innerHTML = '<p class="muted">No hay registros para esta entidad. Pulsa Nuevo registro.</p>';
      return;
    }

    const columns = state.attributes.map(attributeKey);
    $('recordsContainer').innerHTML = `
      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.records.map(record => `
            <tr>
              ${columns.map(col => `<td>${escapeHtml(record.record?.[col] || '')}</td>`).join('')}
              <td class="row-actions">
                <button class="secondary small" data-edit-record="${record.deploymentRecordId}">Editar</button>
                <button class="secondary small danger" data-delete-record="${record.deploymentRecordId}">Borrar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

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
      renderRecords();
    } catch (err) { error(err); }
  }

  async function deleteRecord(recordId) {
    if (!confirm('¿Borrar este registro?')) return;
    try {
      await api.deleteRecord(state.deploymentId, recordId);
      state.records = (await api.listRecords(state.deploymentId, state.entityId)).rows || [];
      renderRecords();
    } catch (err) { error(err); }
  }

})();
