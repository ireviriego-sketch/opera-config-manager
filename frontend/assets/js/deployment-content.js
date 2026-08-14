(() => {
  const api = window.DeploymentContentApi;
  const state = { deploymentId: null, structure: [], searchTerm: '' };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":"&#39;", '"':'&quot;' }[c]));
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; openModal('messageModal'); };
  const error = err => message('Error', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  document.addEventListener('DOMContentLoaded', init);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.delete-dropdown-wrap')) {
      document.querySelectorAll('.delete-dropdown').forEach(d => d.classList.add('hidden'));
    }
  });

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
      renderSearchBar();
      renderStructure();
      if (!state.structure.length) {
        $('structureContainer').innerHTML = '<p class="muted">Este despliegue todavía no tiene estructura copiada.</p>';
      }
    } catch (err) { error(err); }
  }

  function renderSearchBar() {
    const container = $('globalSearchContainer');
    if (!container) return;
    container.innerHTML = `
      <div class="global-search-bar">
        <span class="search-icon">🔍</span>
        <input
          id="globalSearchInput"
          class="global-search-input"
          type="text"
          placeholder="Buscar entidad en todos los dominios..."
          value="${escapeHtml(state.searchTerm)}"
          autocomplete="off"
        />
        <button id="globalSearchClear" class="search-clear ${state.searchTerm ? '' : 'hidden'}" type="button">✕</button>
      </div>
    `;
    $('globalSearchInput').oninput = (e) => {
      state.searchTerm = e.target.value.toLowerCase();
      const clearBtn = $('globalSearchClear');
      if (clearBtn) clearBtn.classList.toggle('hidden', !state.searchTerm);
      renderStructure();
    };
    $('globalSearchClear').onclick = () => {
      state.searchTerm = '';
      renderSearchBar();
      renderStructure();
      $('globalSearchInput').focus();
    };
  }

  function renderStructure() {
    const term = state.searchTerm;

    // Filtrar entidades por término de búsqueda
    let domains = state.structure.map(domain => {
      const filteredEntities = term
        ? (domain.entities || []).filter(e => e.entityName.toLowerCase().includes(term))
        : (domain.entities || []);
      return { ...domain, filteredEntities };
    });

    // Si hay búsqueda, ocultar dominios sin resultados
    if (term) domains = domains.filter(d => d.filteredEntities.length > 0);

    const totalResults = term ? domains.reduce((sum, d) => sum + d.filteredEntities.length, 0) : null;

    $('searchResultsLabel').textContent = term && totalResults !== null
      ? `${totalResults} entidad${totalResults !== 1 ? 'es' : ''} encontrada${totalResults !== 1 ? 's' : ''} en ${domains.length} dominio${domains.length !== 1 ? 's' : ''}`
      : '';

    if (!domains.length && term) {
      $('structureContainer').innerHTML = `<p class="muted">No se encontraron entidades para "<strong>${escapeHtml(term)}</strong>".</p>`;
      return;
    }

    $('structureContainer').innerHTML = domains.length ? domains.map(domain => `
      <div class="domain-card">
        <div class="domain-card-header">
          <h3>${escapeHtml(domain.domainName)}</h3>
          <div class="domain-card-actions">
            <button class="import-domain-btn" data-domain-id="${domain.deploymentDomainId}" data-domain-name="${escapeHtml(domain.domainName)}">Importar</button>
            <div class="delete-dropdown-wrap">
              <button class="delete-domain-btn" data-domain-id="${domain.deploymentDomainId}">Borrar ▾</button>
              <div class="delete-dropdown hidden" id="dropdown-${domain.deploymentDomainId}">
                <p class="dropdown-title">Borrar registros de:</p>
                ${(domain.entities || []).filter(e => Number(e.recordCount) > 0).map(entity => `
                  <button class="dropdown-item" data-entity-id="${entity.deploymentEntityId}" data-entity-name="${escapeHtml(entity.entityName)}" data-record-count="${entity.recordCount}">
                    ${escapeHtml(entity.entityName)}
                    <span class="dropdown-count">${entity.recordCount}</span>
                  </button>
                `).join('')}
                ${(domain.entities || []).filter(e => Number(e.recordCount) > 0).length === 0
                  ? '<p class="dropdown-empty">No hay registros que borrar</p>'
                  : `<div class="dropdown-divider"></div>
                     <button class="dropdown-item dropdown-item-all" data-domain-id="${domain.deploymentDomainId}" data-domain-name="${escapeHtml(domain.domainName)}">
                       Borrar todos
                     </button>`
                }
              </div>
            </div>
          </div>
        </div>
        <div class="entity-list">
          ${domain.filteredEntities.map(entity => {
            const count = Number(entity.recordCount || 0);
            const nameHtml = term
              ? escapeHtml(entity.entityName).replace(new RegExp(`(${escapeHtml(term)})`, 'gi'), '<mark>$1</mark>')
              : escapeHtml(entity.entityName);
            return `
            <button class="entity-button" data-entity-id="${entity.deploymentEntityId}">
              <span>${nameHtml}</span>
              <small class="${count > 0 ? 'count-ok' : 'count-empty'}">${count} registros</small>
            </button>`;
          }).join('')}
        </div>
      </div>
    `).join('') : '<p class="muted">No hay dominios copiados para este despliegue.</p>';

    // Navegar a entidad
    document.querySelectorAll('.entity-button[data-entity-id]').forEach(button =>
      button.onclick = () => {
        const entityId = button.dataset.entityId;
        if (entityId) window.location.href = `deployment-entity.html?deploymentId=${state.deploymentId}&entityId=${entityId}`;
      }
    );

    // Importar
    document.querySelectorAll('.import-domain-btn').forEach(button =>
      button.onclick = (e) => { e.stopPropagation(); openImportModal(Number(button.dataset.domainId), button.dataset.domainName); }
    );

    // Abrir/cerrar desplegable borrar
    document.querySelectorAll('.delete-domain-btn').forEach(button =>
      button.onclick = (e) => {
        e.stopPropagation();
        const domainId = button.dataset.domainId;
        const dropdown = $(`dropdown-${domainId}`);
        document.querySelectorAll('.delete-dropdown').forEach(d => { if (d !== dropdown) d.classList.add('hidden'); });
        dropdown.classList.toggle('hidden');
      }
    );

    // Borrar entidad concreta
    document.querySelectorAll('.dropdown-item[data-entity-id]').forEach(button =>
      button.onclick = async (e) => {
        e.stopPropagation();
        const entityId = button.dataset.entityId;
        const entityName = button.dataset.entityName;
        const count = button.dataset.recordCount;
        if (!confirm(`¿Borrar los ${count} registros de "${entityName}"? Esta acción no se puede deshacer.`)) return;
        await deleteEntityRecords(entityId, entityName);
      }
    );

    // Borrar todos del dominio
    document.querySelectorAll('.dropdown-item-all').forEach(button =>
      button.onclick = async (e) => {
        e.stopPropagation();
        const domainId = button.dataset.domainId;
        const domainName = button.dataset.domainName;
        const domain = state.structure.find(d => String(d.deploymentDomainId) === String(domainId));
        if (!domain) return;
        const entitiesWithRecords = (domain.entities || []).filter(e => Number(e.recordCount) > 0);
        if (!entitiesWithRecords.length) return;
        const total = entitiesWithRecords.reduce((sum, e) => sum + Number(e.recordCount), 0);
        if (!confirm(`¿Borrar TODOS los registros del dominio "${domainName}" (${total} registros en total)? Esta acción no se puede deshacer.`)) return;
        for (const entity of entitiesWithRecords) {
          await deleteEntityRecords(entity.deploymentEntityId, entity.entityName, true);
        }
        await loadStructure();
        message('Completado', `<p>Se han borrado todos los registros del dominio <strong>${escapeHtml(domainName)}</strong>.</p>`);
      }
    );
  }

  async function deleteEntityRecords(entityId, entityName, silent = false) {
    try {
      const response = await fetch(`/api/opera-config/deployment-content/${state.deploymentId}/entities/${entityId}/records`, {
        method: 'DELETE'
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) throw new Error(body.error || `HTTP ${response.status}`);
      if (!silent) {
        await loadStructure();
        message('Registros borrados', `<p>Se han borrado <strong>${body.deleted}</strong> registros de <strong>${escapeHtml(entityName)}</strong>.</p>`);
      }
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
        method: 'POST', body: formData
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) throw new Error(body.error || `HTTP ${response.status}`);
      $('importStatus').innerHTML = `<span style="color:#027a48">✅ ${body.inserted} registros insertados, ${body.skipped} omitidos.</span>`;
      let preview = '';
      if (body.processedSheets?.length) {
        preview += `<p style="margin-top:12px;font-size:13px;font-weight:700">Entidades importadas:</p><ul style="font-size:13px;margin:4px 0 0 16px">${body.processedSheets.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
      }
      if (body.errors?.length) {
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
