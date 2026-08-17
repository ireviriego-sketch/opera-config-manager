(() => {
  const api = window.DeploymentDesignerApi;
  const state = {
    deploymentId: null,
    deployment: null,
    structure: [],
    selectedDomainId: null,
    selectedEntity: null,
    selectedDomain: null,
    attributes: [],
    records: [],
    editingRecord: null,
    drag: null
  };

  const $ = id => document.getElementById(id);
  const escapeHtml = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])));
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; openModal('messageModal'); };
  const error = err => message('Error', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    state.deploymentId = new URLSearchParams(window.location.search).get('id');
    if (!state.deploymentId) { error('Falta id de despliegue en la URL.'); return; }

    $('backBtn').onclick = () => history.back();
    $('refreshBtn').onclick = loadAll;
    $('fitCanvasBtn').onclick = renderCanvas;
    $('exportAllBtn').onclick = exportDeploymentJson;
    $('closeDrawerBtn').onclick = () => hide($('entityDrawer'));
    $('newRecordBtn').onclick = newRecord;
    $('importExcelBtn').onclick = () => message('Import Excel', '<p>Excel import will be connected in the next step. This screen already knows which entity and attributes to use.</p>');
    $('exportExcelBtn').onclick = exportCurrentEntityCsv;
    $('closeRecordModalBtn').onclick = () => closeModal('recordModal');
    $('closeMessageBtn').onclick = () => closeModal('messageModal');
    $('recordForm').onsubmit = saveRecord;

    window.addEventListener('resize', drawRelationships);
    await loadAll();
  }

  function openModal(id) { document.body.classList.add('modal-open'); show($(id)); }
  function closeModal(id) { hide($(id)); if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open'); }

  async function loadAll() {
    try {
      state.deployment = (await api.getDeployment(state.deploymentId)).deployment;
      const structureResponse = await api.getStructure(state.deploymentId);
      state.structure = structureResponse.structure || [];
      state.selectedDomainId = state.structure[0]?.deploymentDomainId || null;
      renderHeader();
      renderDomains();
      renderCanvas();
    } catch (err) { error(err); }
  }

  function renderHeader() {
    if (!state.deployment) return;
    $('designerTitle').textContent = state.deployment.deploymentName || `Despliegue ${state.deploymentId}`;
    $('designerSubtitle').textContent = `${state.deployment.chainName || ''} · Source Version ${state.deployment.sourceTemplateVersionId || 'no version'}`;
  }

  function renderDomains() {
    $('domainCountBadge').textContent = state.structure.length;
    $('domainList').innerHTML = state.structure.length ? state.structure.map(domain => {
      const entities = domain.entities || [];
      const active = Number(domain.deploymentDomainId) === Number(state.selectedDomainId) ? ' active' : '';
      return `<button class="domain-filter-button${active}" data-domain-id="${domain.deploymentDomainId}">
        <strong>${escapeHtml(domain.domainName)}</strong>
        <small>${entities.length} entities</small>
      </button>`;
    }).join('') : '<p class="muted">No copied domains. Edit the deployment and save with a source version.</p>';

    document.querySelectorAll('[data-domain-id]').forEach(btn => btn.onclick = () => {
      state.selectedDomainId = Number(btn.dataset.domainId);
      renderDomains();
      renderCanvas();
    });
  }

  function getVisibleDomains() {
    if (!state.selectedDomainId) return state.structure;
    return state.structure.filter(domain => Number(domain.deploymentDomainId) === Number(state.selectedDomainId));
  }

  function renderCanvas() {
    const canvas = $('canvas');
    const domains = getVisibleDomains();
    if (!domains.length) {
      canvas.innerHTML = '<div class="empty-canvas"><p>No copied structure for this deployment.</p></div>';
      $('relationshipLayer').innerHTML = '';
      return;
    }

    let html = '';
    let top = 24;
    domains.forEach(domain => {
      const entities = domain.entities || [];
      const cols = 3;
      const cardW = 230;
      const cardH = 130;
      const gapX = 70;
      const gapY = 54;
      const rows = Math.max(1, Math.ceil(entities.length / cols));
      const bandH = 88 + rows * (cardH + gapY);
      const bandW = 880;
      html += `<section class="domain-band" style="left:24px; top:${top}px; width:${bandW}px; height:${bandH}px;" data-domain-band="${domain.deploymentDomainId}">
        <div class="domain-band-title"><span>${escapeHtml(domain.domainName)}</span><small>${entities.length} entities</small></div>
      </section>`;

      entities.forEach((entity, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = 52 + col * (cardW + gapX);
        const y = top + 72 + row * (cardH + gapY);
        html += `<article class="entity-card" style="left:${x}px; top:${y}px;" data-entity-id="${entity.deploymentEntityId}" data-domain-id="${domain.deploymentDomainId}">
          <h3>${escapeHtml(entity.entityName)}</h3>
          <div class="entity-meta"><span>${escapeHtml(entity.entityCode || '')}</span><span>${(entity.attributes || []).length} attrs</span></div>
          <span class="entity-record-chip">${Number(entity.recordCount || 0)} records</span>
        </article>`;
      });
      top += bandH + 36;
    });

    canvas.style.minHeight = Math.max(640, top + 80) + 'px';
    canvas.innerHTML = html;
    bindEntityCards();
    setTimeout(drawRelationships, 0);
  }

  function bindEntityCards() {
    document.querySelectorAll('.entity-card').forEach(card => {
      card.ondblclick = () => openEntity(Number(card.dataset.entityId));
      card.onmousedown = startDrag;
    });
  }

  function startDrag(event) {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const canvasRect = $('canvas').getBoundingClientRect();
    state.drag = { card, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, canvasRect };
    card.style.cursor = 'grabbing';
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  }

  function doDrag(event) {
    if (!state.drag) return;
    const { card, offsetX, offsetY, canvasRect } = state.drag;
    card.style.left = `${event.clientX - canvasRect.left - offsetX + $('canvasWrapper').scrollLeft}px`;
    card.style.top = `${event.clientY - canvasRect.top - offsetY + $('canvasWrapper').scrollTop}px`;
    drawRelationships();
  }

  function stopDrag() {
    if (state.drag?.card) state.drag.card.style.cursor = 'grab';
    state.drag = null;
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  function drawRelationships() {
    const svg = $('relationshipLayer');
    const wrapper = $('canvasWrapper');
    const canvasRect = $('canvas').getBoundingClientRect();
    svg.setAttribute('width', $('canvas').scrollWidth);
    svg.setAttribute('height', $('canvas').scrollHeight);
    svg.innerHTML = '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#6b46c1" /></marker></defs>';

    getVisibleDomains().forEach(domain => {
      const cards = [...document.querySelectorAll(`.entity-card[data-domain-id="${domain.deploymentDomainId}"]`)];
      for (let i = 0; i < cards.length - 1; i++) {
        const a = cards[i].getBoundingClientRect();
        const b = cards[i + 1].getBoundingClientRect();
        const x1 = a.right - canvasRect.left + wrapper.scrollLeft;
        const y1 = a.top + a.height / 2 - canvasRect.top + wrapper.scrollTop;
        const x2 = b.left - canvasRect.left + wrapper.scrollLeft;
        const y2 = b.top + b.height / 2 - canvasRect.top + wrapper.scrollTop;
        const mid = (x1 + x2) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#6b46c1');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(path);
      }
    });
  }

  function findEntity(entityId) {
    for (const domain of state.structure) {
      const entity = (domain.entities || []).find(item => Number(item.deploymentEntityId) === Number(entityId));
      if (entity) return { domain, entity };
    }
    return null;
  }

  async function openEntity(entityId) {
    const found = findEntity(entityId);
    if (!found) return;
    state.selectedDomain = found.domain;
    state.selectedEntity = found.entity;
    document.querySelectorAll('.entity-card').forEach(card => card.classList.toggle('selected', Number(card.dataset.entityId) === Number(entityId)));
    $('drawerDomain').textContent = found.domain.domainName;
    $('drawerTitle').textContent = found.entity.entityName;
    $('drawerSubtitle').textContent = `${found.entity.entityCode || ''} · ${found.entity.recordCount || 0} records`;

    try {
      state.attributes = (await api.getAttributes(state.deploymentId, entityId)).rows || [];
      state.records = (await api.listRecords(state.deploymentId, entityId)).rows || [];
      renderAttributes();
      renderRecords();
      show($('entityDrawer'));
    } catch (err) { error(err); }
  }

  function attributeKey(attribute) {
    return attribute.attributeCode || attribute.attributeName || `ATTR_${attribute.deploymentAttributeId}`;
  }

  function renderAttributes() {
    $('attributeCountBadge').textContent = state.attributes.length;
    $('attributeList').innerHTML = state.attributes.length ? state.attributes.map(attr => `<span class="attribute-pill" title="${escapeHtml(attr.dataType || '')}">${escapeHtml(attributeKey(attr))}${attr.isRequired === 'Y' ? ' *' : ''}</span>`).join('') : '<p class="muted">Esta entity no tiene atributos.</p>';
  }

  function renderRecords() {
    if (!state.records.length) {
      $('recordsContainer').innerHTML = '<p class="muted">No records for this entity. Click New.</p>';
      return;
    }
    const columns = state.attributes.map(attributeKey);
    $('recordsContainer').innerHTML = `<table><thead><tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}<th></th></tr></thead><tbody>${state.records.map(record => `<tr>${columns.map(col => `<td>${escapeHtml(record.record?.[col] || '')}</td>`).join('')}<td class="row-actions"><button class="secondary small" data-edit-record="${record.deploymentRecordId}">Edit</button><button class="secondary small" data-delete-record="${record.deploymentRecordId}">Delete</button></td></tr>`).join('')}</tbody></table>`;
    document.querySelectorAll('[data-edit-record]').forEach(btn => btn.onclick = () => editRecord(Number(btn.dataset.editRecord)));
    document.querySelectorAll('[data-delete-record]').forEach(btn => btn.onclick = () => deleteRecord(Number(btn.dataset.deleteRecord)));
  }

  function newRecord() {
    if (!state.selectedEntity) return;
    state.editingRecord = null;
    $('recordModalTitle').textContent = `New Record - ${state.selectedEntity.entityName}`;
    renderRecordForm({});
    openModal('recordModal');
  }

  function editRecord(recordId) {
    const record = state.records.find(item => Number(item.deploymentRecordId) === Number(recordId));
    if (!record) return;
    state.editingRecord = record;
    $('recordModalTitle').textContent = `Edit record - ${state.selectedEntity.entityName}`;
    renderRecordForm(record.record || {});
    openModal('recordModal');
  }

  function renderRecordForm(values) {
    $('recordForm').innerHTML = state.attributes.map(attr => {
      const key = attributeKey(attr);
      return `<label>${escapeHtml(key)}${attr.isRequired === 'Y' ? ' *' : ''}<input class="input" data-record-field="${escapeHtml(key)}" value="${escapeHtml(values[key] || attr.defaultValue || '')}" /></label>`;
    }).join('') + '<div class="form-actions"><button class="primary" type="submit">Save Record</button></div>';
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!state.selectedEntity) return;
    const record = {};
    document.querySelectorAll('[data-record-field]').forEach(input => { record[input.dataset.recordField] = input.value.trim(); });
    try {
      if (state.editingRecord) await api.updateRecord(state.deploymentId, state.editingRecord.deploymentRecordId, record);
      else await api.createRecord(state.deploymentId, state.selectedEntity.deploymentEntityId, record);
      closeModal('recordModal');
      await openEntity(state.selectedEntity.deploymentEntityId);
      await loadAll();
    } catch (err) { error(err); }
  }

  async function deleteRecord(recordId) {
    if (!confirm('Delete this record?')) return;
    try {
      await api.deleteRecord(state.deploymentId, recordId);
      await openEntity(state.selectedEntity.deploymentEntityId);
      await loadAll();
    } catch (err) { error(err); }
  }

  async function exportDeploymentJson() {
    try {
      const data = await api.exportContent(state.deploymentId);
      const blob = new Blob([JSON.stringify(data.content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deployment-${state.deploymentId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) { error(err); }
  }

  function exportCurrentEntityCsv() {
    if (!state.selectedEntity) return;
    const columns = state.attributes.map(attributeKey);
    const rows = [columns.join(',')].concat(state.records.map(record => columns.map(col => `"${String(record.record?.[col] || '').replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.selectedEntity.entityCode || state.selectedEntity.entityName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
})();
