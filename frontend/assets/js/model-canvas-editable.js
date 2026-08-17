let currentTemplateId = null;
let currentVersionId = null;
let domains = [];
let allEntities = [];
let visibleEntities = [];
let selectedEntityId = null;
let draggingBox = null;
let dragOffset = { x: 0, y: 0 };
let dataTypes = [];

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    templateId: params.get('templateId'),
    versionId: params.get('versionId')
  };
}

function storageKey() {
  return `operaModelCanvasEditable:v${currentVersionId}`;
}

function getLayout() {
  try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); }
  catch (error) { return {}; }
}

function saveLayout(layout) {
  localStorage.setItem(storageKey(), JSON.stringify(layout));
}

function colorForDomain(code) {
  const colors = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];
  let hash = 0;
  String(code || '').split('').forEach(char => { hash = ((hash << 5) - hash) + char.charCodeAt(0); });
  return colors[Math.abs(hash) % colors.length];
}

function textIncludes(value, search) {
  return String(value || '').toLowerCase().includes(search);
}

function entityMatches(entity, search) {
  if (!search) return true;
  return textIncludes(entity.ENTITY_CODE, search)
    || textIncludes(entity.ENTITY_NAME, search)
    || textIncludes(entity.ENTITY_DESCRIPTION, search)
    || entity.attributes.some(attribute =>
      textIncludes(attribute.ATTRIBUTE_CODE, search)
      || textIncludes(attribute.ATTRIBUTE_NAME, search)
      || textIncludes(attribute.DATA_TYPE_NAME, search)
    );
}

async function loadVersionHeader() {
  const data = await apiFetch(`/api/template-versions?templateId=${encodeURIComponent(currentTemplateId)}`);
  const version = (data.versions || []).find(v => String(v.VERSION_ID) === String(currentVersionId));
  if (!version) return;
  document.getElementById('versionTitle').textContent = version.VERSION_LABEL || `Version ${version.VERSION_NUMBER}`;
  document.getElementById('canvasSubtitle').textContent = `Version ${version.VERSION_NUMBER} · ${version.VERSION_STATUS}`;
}

async function loadDataTypes() {
  if (window.LovsClient) dataTypes = await window.LovsClient.dataTypes();
  else {
    const data = await apiFetch('/api/attributes/data-types');
    dataTypes = data.dataTypes || [];
  }
}

async function loadModel() {
  const domainData = await apiFetch(`/api/domains?versionId=${encodeURIComponent(currentVersionId)}`);
  domains = domainData.domains || [];
  allEntities = [];

  for (const domain of domains) {
    const entityData = await apiFetch(`/api/entities?domainId=${encodeURIComponent(domain.DOMAIN_ID)}`);
    for (const entity of (entityData.entities || [])) {
      const attrData = await apiFetch(`/api/attributes?entityId=${encodeURIComponent(entity.ENTITY_ID)}`);
      allEntities.push({ ...entity, domain, attributes: attrData.attributes || [] });
    }
  }

  populateDomainFilter();
  applyFilters();
  updateStats();
}

function populateDomainFilter() {
  const filter = document.getElementById('domainFilter');
  filter.innerHTML = '<option value="ALL">All Domains</option>';
  domains.forEach(domain => {
    const option = document.createElement('option');
    option.value = String(domain.DOMAIN_ID);
    option.textContent = domain.DOMAIN_NAME || domain.DOMAIN_CODE;
    filter.appendChild(option);
  });
}

function updateStats() {
  const attributeCount = allEntities.reduce((total, entity) => total + entity.attributes.length, 0);
  document.getElementById('versionStats').textContent = `${domains.length} domains · ${allEntities.length} entities · ${attributeCount} attributes`;
}

function applyFilters() {
  const domainId = document.getElementById('domainFilter').value;
  const search = document.getElementById('canvasSearch').value.trim().toLowerCase();
  visibleEntities = allEntities.filter(entity => {
    const domainOk = domainId === 'ALL' || String(entity.domain.DOMAIN_ID) === domainId;
    return domainOk && entityMatches(entity, search);
  });
  renderCanvas();
}

function defaultPosition(entity, index) {
  const domainIndex = domains.findIndex(d => String(d.DOMAIN_ID) === String(entity.domain.DOMAIN_ID));
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 50 + col * 330, y: 50 + row * 190 + Math.max(domainIndex, 0) * 24, collapsed: true };
}

function entityLayout(entity, index) {
  const saved = getLayout()[String(entity.ENTITY_ID)] || {};
  return { ...defaultPosition(entity, index), ...saved };
}

function updateEntityLayout(entityId, patch) {
  const layout = getLayout();
  layout[String(entityId)] = { ...(layout[String(entityId)] || {}), ...patch };
  saveLayout(layout);
}

function renderCanvas() {
  const stage = document.getElementById('canvasStage');
  const layer = document.getElementById('connectionLayer');
  stage.innerHTML = '';
  layer.innerHTML = '';

  visibleEntities.forEach((entity, index) => {
    const layout = entityLayout(entity, index);
    const collapsed = layout.collapsed !== false;
    const color = colorForDomain(entity.domain.DOMAIN_CODE);
    const box = document.createElement('article');
    box.className = `canvas2-box ${collapsed ? 'collapsed' : ''} ${String(entity.ENTITY_ID) === String(selectedEntityId) ? 'selected' : ''}`;
    box.dataset.entityId = entity.ENTITY_ID;
    box.style.left = `${layout.x}px`;
    box.style.top = `${layout.y}px`;
    box.innerHTML = `
      <header class="canvas2-card-head" style="border-left-color:${color}">
        <div>
          <h3>${entity.ENTITY_NAME || entity.ENTITY_CODE}</h3>
          <p>${entity.domain.DOMAIN_NAME || entity.domain.DOMAIN_CODE}</p>
        </div>
        <button class="canvas2-toggle">${collapsed ? '+' : '-'}</button>
      </header>
      <div class="canvas2-card-summary">
        <span class="canvas2-pill">${entity.attributes.length} attributes</span>
        <span class="canvas2-pill">${entity.ENTITY_CODE || ''}</span>
      </div>
      <section class="canvas2-card-body">
        ${entity.attributes.slice(0, 5).map(attribute => `
          <div class="canvas2-attribute-mini">
            <strong>${attribute.ATTRIBUTE_CODE || ''}</strong>
            <span>${attribute.DATA_TYPE_NAME || attribute.DATA_TYPE_CODE || ''}</span>
          </div>
        `).join('')}
      </section>
    `;
    stage.appendChild(box);
  });

  window.requestAnimationFrame(drawConnections);
}

function drawConnections() {
  const layer = document.getElementById('connectionLayer');
  layer.innerHTML = '';
  const boxes = Array.from(document.querySelectorAll('.canvas2-box'));
  const byDomain = new Map();
  boxes.forEach(box => {
    const entity = visibleEntities.find(item => String(item.ENTITY_ID) === String(box.dataset.entityId));
    if (!entity) return;
    const key = String(entity.domain.DOMAIN_ID);
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key).push({ box, entity });
  });
  byDomain.forEach(items => {
    const ordered = items.slice().sort((a, b) => parseFloat(a.box.style.left) - parseFloat(b.box.style.left));
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i].box;
      const b = ordered[i + 1].box;
      const x1 = parseFloat(a.style.left) + a.offsetWidth;
      const y1 = parseFloat(a.style.top) + a.offsetHeight / 2;
      const x2 = parseFloat(b.style.left);
      const y2 = parseFloat(b.style.top) + b.offsetHeight / 2;
      if (x2 < x1) continue;
      const mid = (x1 + x2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
      path.setAttribute('class', 'connection-path');
      layer.appendChild(path);
    }
  });
}

function selectedEntity() {
  return allEntities.find(entity => String(entity.ENTITY_ID) === String(selectedEntityId));
}

function showInspector(entity) {
  selectedEntityId = entity.ENTITY_ID;
  document.getElementById('inspectorTitle').textContent = entity.ENTITY_NAME || entity.ENTITY_CODE;
  document.getElementById('inspectorSubtitle').textContent = `${entity.domain.DOMAIN_NAME || entity.domain.DOMAIN_CODE} · ${entity.ENTITY_CODE}`;
  renderInspectorAttributes(entity);
  renderCanvas();
}

function renderInspectorAttributes(entity) {
  const body = document.getElementById('inspectorBody');
  body.innerHTML = `
    <div class="inspector-meta">
      <div class="detail-item"><span>Entity</span><strong>${entity.ENTITY_CODE || '-'}</strong></div>
      <div class="detail-item"><span>Attributes</span><strong>${entity.attributes.length}</strong></div>
    </div>
    <div class="inspector-attr-list">
      ${entity.attributes.map(attribute => `
        <div class="inspector-attr-row">
          <div>
            <strong>${attribute.ATTRIBUTE_CODE || ''}</strong>
            <span>${attribute.ATTRIBUTE_NAME || ''} · ${attribute.DATA_TYPE_NAME || attribute.DATA_TYPE_CODE || ''}</span>
          </div>
          <button class="attribute-edit-button" data-attribute-id="${attribute.ATTRIBUTE_ID}">Edit</button>
        </div>
      `).join('')}
    </div>
  `;
}

function openAttributeEdit(attributeId) {
  const entity = selectedEntity();
  if (!entity) return;
  const attribute = entity.attributes.find(item => String(item.ATTRIBUTE_ID) === String(attributeId));
  if (!attribute) return;

  document.getElementById('editAttributeId').value = attribute.ATTRIBUTE_ID;
  document.getElementById('editAttributeCode').value = attribute.ATTRIBUTE_CODE || '';
  document.getElementById('editAttributeName').value = attribute.ATTRIBUTE_NAME || '';
  document.getElementById('editAttributeDescription').value = attribute.ATTRIBUTE_DESCRIPTION || '';
  document.getElementById('editMaxLength').value = attribute.MAX_LENGTH || '';
  document.getElementById('editDefaultValue').value = attribute.DEFAULT_VALUE || '';
  document.getElementById('editIsRequired').checked = attribute.IS_REQUIRED === 'Y';
  document.getElementById('editIsKeyAttribute').checked = attribute.IS_KEY_ATTRIBUTE === 'Y';
  document.getElementById('editAttributeOrder').value = attribute.DISPLAY_ORDER || 0;
  document.getElementById('attributeEditMessage').textContent = '';

  const select = document.getElementById('editDataTypeCode');
  select.innerHTML = '';
  dataTypes.forEach(dt => {
    const option = document.createElement('option');
    option.value = dt.DATA_TYPE_CODE;
    option.textContent = dt.DATA_TYPE_NAME;
    if (dt.DATA_TYPE_CODE === attribute.DATA_TYPE_CODE) option.selected = true;
    select.appendChild(option);
  });

  document.getElementById('attributeEditModal').classList.remove('hidden');
}

function closeAttributeEdit() {
  document.getElementById('attributeEditModal').classList.add('hidden');
}

async function saveAttributeEdit() {
  const attributeId = document.getElementById('editAttributeId').value;
  const message = document.getElementById('attributeEditMessage');
  message.textContent = '';

  const payload = {
    code: document.getElementById('editAttributeCode').value.trim(),
    name: document.getElementById('editAttributeName').value.trim(),
    description: document.getElementById('editAttributeDescription').value.trim(),
    dataTypeCode: document.getElementById('editDataTypeCode').value,
    maxLength: document.getElementById('editMaxLength').value,
    defaultValue: document.getElementById('editDefaultValue').value.trim(),
    isRequired: document.getElementById('editIsRequired').checked ? 'Y' : 'N',
    isKeyAttribute: document.getElementById('editIsKeyAttribute').checked ? 'Y' : 'N',
    displayOrder: document.getElementById('editAttributeOrder').value
  };

  if (!payload.code || !payload.name || !payload.dataTypeCode) {
    message.textContent = 'Code, name, and data type are required.';
    return;
  }

  try {
    await apiFetch(`/api/attributes/${encodeURIComponent(attributeId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    closeAttributeEdit();
    await loadModel();
    const entity = selectedEntity();
    if (entity) showInspector(entity);
  } catch (error) {
    message.textContent = error.data?.error || 'Unable to save the attribute.';
  }
}

function pointerInStage(event) {
  const rect = document.getElementById('canvasStage').getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function setupCanvasEvents() {
  const stage = document.getElementById('canvasStage');
  stage.addEventListener('pointerdown', event => {
    const toggle = event.target.closest('.canvas2-toggle');
    if (toggle) return;
    const box = event.target.closest('.canvas2-box');
    if (!box) return;
    draggingBox = box;
    const pos = pointerInStage(event);
    dragOffset.x = pos.x - parseFloat(box.style.left);
    dragOffset.y = pos.y - parseFloat(box.style.top);
    box.setPointerCapture(event.pointerId);
    box.classList.add('dragging');
  });
  stage.addEventListener('pointermove', event => {
    if (!draggingBox) return;
    const pos = pointerInStage(event);
    const x = Math.max(0, pos.x - dragOffset.x);
    const y = Math.max(0, pos.y - dragOffset.y);
    draggingBox.style.left = `${x}px`;
    draggingBox.style.top = `${y}px`;
    drawConnections();
  });
  stage.addEventListener('pointerup', () => {
    if (!draggingBox) return;
    updateEntityLayout(draggingBox.dataset.entityId, { x: parseFloat(draggingBox.style.left), y: parseFloat(draggingBox.style.top) });
    draggingBox.classList.remove('dragging');
    draggingBox = null;
  });
  stage.addEventListener('click', event => {
    const toggle = event.target.closest('.canvas2-toggle');
    if (toggle) {
      const box = event.target.closest('.canvas2-box');
      const current = entityLayout(visibleEntities.find(item => String(item.ENTITY_ID) === String(box.dataset.entityId)), 0);
      updateEntityLayout(box.dataset.entityId, { collapsed: current.collapsed === false });
      renderCanvas();
      return;
    }
    const box = event.target.closest('.canvas2-box');
    if (!box) return;
    const entity = visibleEntities.find(item => String(item.ENTITY_ID) === String(box.dataset.entityId));
    if (entity) showInspector(entity);
  });
  stage.addEventListener('dblclick', event => {
    const box = event.target.closest('.canvas2-box');
    if (!box) return;
    const entity = visibleEntities.find(item => String(item.ENTITY_ID) === String(box.dataset.entityId));
    if (!entity) return;
    window.location.href = `entity-detail.html?id=${encodeURIComponent(entity.ENTITY_ID)}&domainId=${encodeURIComponent(entity.domain.DOMAIN_ID)}&versionId=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}`;
  });
}

function arrangeVisibleEntities() {
  const layout = getLayout();
  visibleEntities.forEach((entity, index) => {
    layout[String(entity.ENTITY_ID)] = defaultPosition(entity, index);
  });
  saveLayout(layout);
  renderCanvas();
}

function setupToolbar() {
  document.getElementById('backToTemplate').addEventListener('click', () => {
    window.location.href = `template-detail.html?id=${encodeURIComponent(currentTemplateId)}`;
  });
  document.getElementById('domainFilter').addEventListener('change', applyFilters);
  document.getElementById('canvasSearch').addEventListener('input', applyFilters);
  document.getElementById('btnFit').addEventListener('click', arrangeVisibleEntities);
  document.getElementById('btnCollapse').addEventListener('click', () => {
    visibleEntities.forEach(entity => updateEntityLayout(entity.ENTITY_ID, { collapsed: true }));
    renderCanvas();
  });
  document.getElementById('btnExpand').addEventListener('click', () => {
    visibleEntities.forEach(entity => updateEntityLayout(entity.ENTITY_ID, { collapsed: false }));
    renderCanvas();
  });
  document.getElementById('btnReset').addEventListener('click', () => {
    localStorage.removeItem(storageKey());
    renderCanvas();
  });
  document.getElementById('closeInspector').addEventListener('click', () => {
    selectedEntityId = null;
    document.getElementById('inspectorTitle').textContent = 'Select an entity';
    document.getElementById('inspectorSubtitle').textContent = 'You will see its attributes and can edit them here.';
    document.getElementById('inspectorBody').innerHTML = '<div class="empty-state">Click a box to view its attributes. Click Edit on an attribute to modify it.</div>';
    renderCanvas();
  });
  document.getElementById('inspectorBody').addEventListener('click', event => {
    const button = event.target.closest('.attribute-edit-button');
    if (!button) return;
    openAttributeEdit(button.dataset.attributeId);
  });
  document.getElementById('closeAttributeEditModal').addEventListener('click', closeAttributeEdit);
  document.getElementById('cancelAttributeEdit').addEventListener('click', closeAttributeEdit);
  document.getElementById('saveAttributeEdit').addEventListener('click', saveAttributeEdit);
}

async function setupPage() {
  const params = getParams();
  currentTemplateId = params.templateId;
  currentVersionId = params.versionId;
  setupToolbar();
  setupCanvasEvents();
  await loadDataTypes();
  await loadVersionHeader();
  await loadModel();
}

setupPage();
