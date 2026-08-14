(() => {
  const api = window.DeploymentContentApi;
  const state = { deploymentId: null, structure: [] };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":"&#39;", '"':'&quot;' }[c]));
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
    $('closeImportModalBtn').onclick = () => closeModal('importModal');
    $('closeMessageBtn').onclick = () => closeModal('messageModal');
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
        $('structureContainer').innerHTML = '<p class="muted">Este despliegue todavía no tiene estructura copiada. Edita el despliegue y selecciona una versión origen.</p>';
      }
    } catch (err) { error(err); }
  }

  function renderStructure() {
    $('structureContainer').innerHTML = state.structure.length ? state.structure.map(domain => `
      <div class="domain-card">
        <div class="domain-card-header">
          <h3>${escapeHtml(domain.domainName)}</h3>
          <button class="import-domain-btn" data-domain-id="${domain.deploymentDomainId}" data-domain-name="${escapeHtml(domain.domainName)}">Importar</button>
        </div>
        <div class="entity-list">
          ${(domain.entities || []).map(entity => `
            <button class="entity-button" data-entity-id="${entity.deploymentEntityId}">
              <span>${escapeHtml(entity.entityName)}</span>
              <small>${Number(entity.recordCount || 0)} registros</small>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('') : '<p class="muted">No hay dominios copiados para este despliegue.</p>';

    document.querySelectorAll('[data-entity-id]').forEach(button =>
      button.onclick = () => {
        const entityId = button.dataset.entityId;
        window.location.href = `deployment-entity.html?deploymentId=${state.deploymentId}&entityId=${entityId}`;
      }
    );

    document.querySelectorAll('.import-domain-btn').forEach(button =>
      button.onclick = () => openImportModal(Number(button.dataset.domainId), button.dataset.domainName)
    );
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