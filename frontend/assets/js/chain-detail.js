(() => {
  const api = window.ChainsApi;
  const deploymentsApi = window.DeploymentsApi;
  const state = { chainId: null, chain: null, hotels: [], deployments: [], templateVersions: [], currentContent: null, currentContentDeploymentId: null };
  const $ = id => document.getElementById(id);
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const badge = status => `<span class="badge ${status}">${status}</span>`;
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; openGenericModal('messageModal'); };
  const error = err => message('Validación', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    state.chainId = new URLSearchParams(window.location.search).get('id');
    if (!state.chainId) { error('Falta el parámetro id en la URL.'); return; }
    $('saveChainBtn').onclick = saveChain;
    $('newHotelBtn').onclick = newHotel;
    $('cancelHotelBtn').onclick = () => hide($('hotelForm'));
    $('hotelForm').onsubmit = saveHotel;
    $('importHotelsBtn').onclick = importHotels;
    $('closeMessageBtn').onclick = () => closeGenericModal('messageModal');
    $('newDeploymentBtn').onclick = newDeployment;
    $('closeDeploymentModalBtn').onclick = () => closeGenericModal('deploymentModal');
    $('closeContentModalBtn').onclick = () => closeGenericModal('contentModal');
    $('downloadContentBtn').onclick = downloadCurrentContent;
    $('deploymentForm').onsubmit = saveDeployment;
    document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => switchTab(tab.dataset.tab));
    await loadLovSelects(); await loadAll();
  }

  async function loadAll() {
    try {
      state.chain = (await api.getChain(state.chainId)).chain;
      state.hotels = (await api.listHotels(state.chainId)).rows || [];
      state.deployments = (await deploymentsApi.listByChain(state.chainId)).rows || [];
      state.templateVersions = (await deploymentsApi.listTemplateVersions()).rows || [];
      renderChain(); renderHotels(); renderDeployments(); renderTemplateVersions();
    } catch (err) { error(err); }
  }

  function openGenericModal(id) { document.body.classList.add('modal-open'); show($(id)); }
  function closeGenericModal(id) { hide($(id)); if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open'); }

  function renderTemplateVersions() {
    const select = $('sourceTemplateVersionInput');
    if (!select) return;
    select.innerHTML = '<option value="">Sin versión origen</option>' + state.templateVersions.map(v => `<option value="${v.templateVersionId}">${escapeHtml(v.label || ('Version ' + v.templateVersionId))} ${v.status ? '(' + escapeHtml(v.status) + ')' : ''}</option>`).join('');
  }

  function renderChain() {
    const c = state.chain;
    $('pageTitle').textContent = c.chainName;
    $('pageSubtitle').innerHTML = `${escapeHtml(c.chainCode)} · ${badge(c.status)}`;
    $('chainIdInput').value = c.chainId;
    $('chainCodeInput').value = c.chainCode;
    $('chainNameInput').value = c.chainName;
    $('chainStatusInput').value = c.status;
  }

  async function saveChain() {
    try {
      const payload = { chainCode: $('chainCodeInput').value.trim(), chainName: $('chainNameInput').value.trim(), status: $('chainStatusInput').value };
      state.chain = (await api.updateChain(state.chainId, payload)).chain;
      renderChain(); message('Guardado', '<p>Cadena guardada correctamente.</p>');
    } catch (err) { error(err); }
  }

  function switchTab(id) { document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id)); document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== id)); }

  function renderHotels() {
    $('hotelsContainer').innerHTML = state.hotels.length ? `<table><thead><tr><th>HOTEL_ID</th><th>HOTEL_CODE</th><th>HOTEL_NAME</th><th>STATUS</th><th></th></tr></thead><tbody>${state.hotels.map(h => `<tr><td>${h.hotelId}</td><td>${escapeHtml(h.hotelCode)}</td><td>${escapeHtml(h.hotelName)}</td><td>${badge(h.status)}</td><td><button class="secondary small" data-edit-hotel="${h.hotelId}">Editar</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No hay hoteles para esta cadena.</p>';
    document.querySelectorAll('[data-edit-hotel]').forEach(b => b.onclick = () => editHotel(Number(b.dataset.editHotel)));
  }

  function newHotel() { $('hotelIdInput').value=''; $('hotelCodeInput').value=''; $('hotelNameInput').value=''; $('hotelStatusInput').value='ACTIVE'; show($('hotelForm')); }
  function editHotel(id) { const h = state.hotels.find(x => x.hotelId === id); if (!h) return; $('hotelIdInput').value=h.hotelId; $('hotelCodeInput').value=h.hotelCode; $('hotelNameInput').value=h.hotelName; $('hotelStatusInput').value=h.status; show($('hotelForm')); }

  async function saveHotel(event) {
    event.preventDefault();
    try {
      const payload = { hotelCode: $('hotelCodeInput').value.trim(), hotelName: $('hotelNameInput').value.trim(), status: $('hotelStatusInput').value };
      const hotelId = $('hotelIdInput').value;
      if (hotelId) await api.updateHotel(state.chainId, hotelId, payload); else await api.createHotel(state.chainId, payload);
      hide($('hotelForm')); state.hotels = (await api.listHotels(state.chainId)).rows || []; renderHotels();
    } catch (err) { error(err); }
  }

  async function importHotels() {
    try {
      const value = prompt('ID de cadena en Accenture Hospitality. Déjalo vacío para buscar por nombre:');
      const payload = value && value.trim() ? { accChainId: Number(value.trim()) } : {};
      const result = await api.importHotels(state.chainId, payload);
      state.hotels = result.hotels || (await api.listHotels(state.chainId)).rows || [];
      renderHotels(); switchTab('hotelsPanel');
      message('Importación completada', `<p>Origen: ${escapeHtml(result.sourceChainId || 'buscado por nombre')}</p><p>Insertados: ${Number(result.imported || 0)}</p><p>Actualizados: ${Number(result.updated || 0)}</p><p>Omitidos: ${Number(result.skipped || 0)}</p>`);
    } catch (err) { error(err); }
  }

  function renderDeployments() {
    if (!state.deployments.length) { $('deploymentsContainer').innerHTML = '<p class="muted">No hay despliegues OPERA para esta cadena.</p>'; return; }
    $('deploymentsContainer').innerHTML = `<table><thead><tr><th>CHAIN_DEPLOYMENT_ID</th><th>DEPLOYMENT_NAME</th><th>VERSION ORIGEN</th><th>STATUS</th><th>CREATED_AT</th><th>COMMENTS</th><th></th></tr></thead><tbody>${state.deployments.map(dep => `<tr><td>${dep.deploymentId}</td><td>${escapeHtml(dep.deploymentName)}</td><td>${escapeHtml(dep.sourceTemplateVersionId || '')}</td><td>${badge(dep.status)}</td><td>${escapeHtml(dep.createdAt || '')}</td><td>${escapeHtml(dep.comments || '')}</td><td class="row-actions"><button class="secondary small" data-edit-deployment="${dep.deploymentId}" ${dep.locked ? 'disabled' : ''}>Editar</button><button class="secondary small" data-copy-deployment="${dep.deploymentId}">Copiar</button></td></tr>`).join('')}</tbody></table>`;
    document.querySelectorAll('[data-edit-deployment]').forEach(b => b.onclick = () => editDeployment(Number(b.dataset.editDeployment)));
    document.querySelectorAll('[data-copy-deployment]').forEach(b => b.onclick = () => copyDeployment(Number(b.dataset.copyDeployment)));
  }

  function newDeployment() {
    $('deploymentModalTitle').textContent='Nuevo despliegue OPERA';
    $('deploymentIdInput').value='';
    $('deploymentNameInput').value=`Despliegue OPERA ${state.chain.chainCode}`;
    $('deploymentStatusInput').value='DRAFT';
    $('deploymentStatusInput').disabled=true;
    $('deploymentCommentsInput').value='';
    // Preseleccionar la versión activa de la plantilla automáticamente
    const activeVersion = state.templateVersions.find(v => v.status === 'ACTIVE');
    $('sourceTemplateVersionInput').value = activeVersion ? activeVersion.templateVersionId : '';
    openGenericModal('deploymentModal');
  }
  function editDeployment(id) { const dep=state.deployments.find(d => d.deploymentId === id); if (!dep) return; $('deploymentModalTitle').textContent='Editar despliegue OPERA'; $('deploymentIdInput').value=dep.deploymentId; $('deploymentNameInput').value=dep.deploymentName; $('deploymentStatusInput').value=dep.status; $('deploymentStatusInput').disabled=false; $('sourceTemplateVersionInput').value=dep.sourceTemplateVersionId || ''; $('deploymentCommentsInput').value=dep.comments || ''; openGenericModal('deploymentModal'); }

  async function saveDeployment(event) {
    event.preventDefault();
    try {
      const deploymentId = $('deploymentIdInput').value;
      const payload = { deploymentName: $('deploymentNameInput').value.trim(), status: deploymentId ? $('deploymentStatusInput').value : 'DRAFT', sourceTemplateVersionId: $('sourceTemplateVersionInput').value || null, comments: $('deploymentCommentsInput').value.trim() };
      if (deploymentId) await deploymentsApi.update(deploymentId, payload); else await deploymentsApi.createForChain(state.chainId, payload);
      closeGenericModal('deploymentModal'); state.deployments = (await deploymentsApi.listByChain(state.chainId)).rows || []; renderDeployments(); switchTab('deploymentsPanel');
    } catch (err) { error(err); }
  }

  async function copyDeployment(id) { try { await deploymentsApi.copy(id); state.deployments = (await deploymentsApi.listByChain(state.chainId)).rows || []; renderDeployments(); message('Copia creada', '<p>Se ha creado una copia editable del despliegue.</p>'); } catch (err) { error(err); } }
  async function viewContent(id) { try { const data = await deploymentsApi.getContent(id); state.currentContent = data.content; state.currentContentDeploymentId = id; $('deploymentContentPre').textContent = JSON.stringify(data.content, null, 2); openGenericModal('contentModal'); } catch (err) { error(err); } }
  async function exportJson(id) { try { const data = await deploymentsApi.exportJson(id); downloadJson(data.content, `deployment-${id}.json`); } catch (err) { error(err); } }
  function downloadCurrentContent() { if (!state.currentContent) return; downloadJson(state.currentContent, `deployment-${state.currentContentDeploymentId || 'content'}.json`); }
  function downloadJson(content, filename) { const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
})();
