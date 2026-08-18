let currentTemplateId = null;
let currentVersionId = null;
let domains = [];
let allEntities = [];
let visibleEntities = [];
let relationships = [];
let dataTypes = [];
let relationshipTypes = [];
let selectedEntityId = null;
let selectedRelationshipId = null;
let draggingBox = null;
let dragOffset = { x: 0, y: 0 };
let relationshipDraft = null;
let pendingRelationship = null;
let autoExpandTimer = null;
let relationshipDrawFrame = null;
let loadingOverlay = null;

function $(id) { return document.getElementById(id); }

function ensureLoadingOverlay() {
  if (loadingOverlay) return loadingOverlay;

  const shell = document.querySelector('.canvas2-shell');
  if (!shell) return null;

  loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'relationshipLoadingOverlay';
  loadingOverlay.className = 'relationship-loading-overlay hidden';
  loadingOverlay.innerHTML = `
    <div class="relationship-loading-card" role="status" aria-live="polite">
      <div class="relationship-spinner" aria-hidden="true"></div>
      <strong id="relationshipLoadingTitle">Loading...</strong>
      <span id="relationshipLoadingDetail">Please wait.</span>
    </div>
  `;
  shell.appendChild(loadingOverlay);
  return loadingOverlay;
}

function showLoading(title = 'Loading...', detail = 'Please wait.') {
  const overlay = ensureLoadingOverlay();
  if (!overlay) return;
  const titleEl = $('relationshipLoadingTitle');
  const detailEl = $('relationshipLoadingDetail');
  if (titleEl) titleEl.textContent = title;
  if (detailEl) detailEl.textContent = detail;
  overlay.classList.remove('hidden');
}

function updateLoading(detail) {
  const detailEl = $('relationshipLoadingDetail');
  if (detailEl) detailEl.textContent = detail;
}

function hideLoading() {
  const overlay = ensureLoadingOverlay();
  if (!overlay) return;
  overlay.classList.add('hidden');
}

function setButtonBusy(buttonId, busy) {
  const button = $(buttonId);
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
}


function getParams() {
  const p = new URLSearchParams(location.search);
  return { templateId: p.get('templateId'), versionId: p.get('versionId') };
}

function storageKey() { return `operaModelCanvasRelationships:v${currentVersionId}`; }

function getLayout() {
  try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); }
  catch { return {}; }
}

function saveLayout(l) { localStorage.setItem(storageKey(), JSON.stringify(l)); }

function textIncludes(v, s) { return String(v || '').toLowerCase().includes(s); }

function colorForDomain(c) {
  const a = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];
  let h = 0;
  String(c || '').split('').forEach(ch => h = ((h << 5) - h) + ch.charCodeAt(0));
  return a[Math.abs(h) % a.length];
}

function allAttributes() {
  return allEntities.flatMap(e => e.attributes.map(a => ({ ...a, entity: e })));
}

function attributeLabel(a) { return `${a.entity.ENTITY_NAME || a.entity.ENTITY_CODE}.${a.ATTRIBUTE_CODE}`; }

function entityMatches(e, s) {
  return !s || textIncludes(e.ENTITY_CODE, s) || textIncludes(e.ENTITY_NAME, s) || textIncludes(e.ENTITY_DESCRIPTION, s) ||
    e.attributes.some(a => textIncludes(a.ATTRIBUTE_CODE, s) || textIncludes(a.ATTRIBUTE_NAME, s) || textIncludes(a.DATA_TYPE_NAME, s));
}

async function loadVersionHeader() {
  const d = await apiFetch(`/api/template-versions?templateId=${encodeURIComponent(currentTemplateId)}`);
  const v = (d.versions || []).find(x => String(x.VERSION_ID) === String(currentVersionId));
  if (v) {
    $('versionTitle').textContent = v.VERSION_LABEL || `Version ${v.VERSION_NUMBER}`;
    $('canvasSubtitle').textContent = `Version ${v.VERSION_NUMBER} · ${v.VERSION_STATUS}`;
  }
}

async function loadDataTypes() {
  if (window.LovsClient) dataTypes = await window.LovsClient.dataTypes();
  else {
    const d = await apiFetch('/api/attributes/data-types');
    dataTypes = d.dataTypes || [];
  }
}

async function loadRelationshipTypes() {
  relationshipTypes = window.LovsClient ? await window.LovsClient.getValues('RELATIONSHIP_TYPE') : [];
  ['relationshipType', 'manualRelationshipType'].forEach(id => {
    const s = $(id);
    if (!s || !relationshipTypes.length) return;
    const current = s.value;
    s.innerHTML = '';
    relationshipTypes.forEach(v => {
      const o = document.createElement('option');
      o.value = v.valueCode;
      o.textContent = v.valueLabel || v.valueCode;
      s.appendChild(o);
    });
    if (current && Array.from(s.options).some(o => o.value === current)) s.value = current;
  });
}

async function loadModel() {
  updateLoading('Retrieving domains from Oracle.');
  const dd = await apiFetch(`/api/domains?versionId=${encodeURIComponent(currentVersionId)}`);
  domains = dd.domains || [];
  allEntities = [];

  updateLoading('Retrieving entities and attributes from Oracle.');

  for (const domain of domains) {
    const ed = await apiFetch(`/api/entities?domainId=${encodeURIComponent(domain.DOMAIN_ID)}`);
    for (const entity of (ed.entities || [])) {
      const ad = await apiFetch(`/api/attributes?entityId=${encodeURIComponent(entity.ENTITY_ID)}`);
      allEntities.push({ ...entity, domain, attributes: ad.attributes || [] });
    }
  }

  updateLoading('Retrieving relationships from Oracle.');
  const rd = await apiFetch(`/api/relationships?versionId=${encodeURIComponent(currentVersionId)}`);
  relationships = rd.relationships || [];
  updateLoading('Rendering relationship canvas.');
  populateDomainFilter();
  applyFilters();
  updateStats();
}

function populateDomainFilter() {
  const df = $('domainFilter');
  df.innerHTML = '<option value="ALL">All Domains</option>';
  domains.forEach(d => {
    const o = document.createElement('option');
    o.value = String(d.DOMAIN_ID);
    o.textContent = d.DOMAIN_NAME || d.DOMAIN_CODE;
    df.appendChild(o);
  });
}

function updateStats() {
  const ac = allEntities.reduce((t, e) => t + e.attributes.length, 0);
  $('versionStats').textContent = `${domains.length} domains · ${allEntities.length} entities · ${ac} attributes · ${relationships.length} real relationships`;
}

function applyFilters() {
  const did = $('domainFilter').value;
  const s = $('canvasSearch').value.trim().toLowerCase();
  visibleEntities = allEntities.filter(e => (did === 'ALL' || String(e.domain.DOMAIN_ID) === did) && entityMatches(e, s));
  renderCanvas();
}

function defaultPosition(e, i) {
  const di = domains.findIndex(d => String(d.DOMAIN_ID) === String(e.domain.DOMAIN_ID));
  const col = i % 4;
  const row = Math.floor(i / 4);
  return { x: 50 + col * 330, y: 50 + row * 190 + Math.max(di, 0) * 24, collapsed: true };
}

function entityLayout(e, i) {
  const saved = getLayout()[String(e.ENTITY_ID)] || {};
  return { ...defaultPosition(e, i), ...saved };
}

function updateEntityLayout(id, patch) {
  const l = getLayout();
  l[String(id)] = { ...(l[String(id)] || {}), ...patch };
  saveLayout(l);
}

function isVisibleEntity(id) { return visibleEntities.some(e => String(e.ENTITY_ID) === String(id)); }

function canvasBoxElement(id) {
  return $('canvasStage').querySelector(`.canvas2-box[data-entity-id="${id}"]`);
}

function canvasAttributeElement(id) {
  return $('canvasStage').querySelector(`.canvas2-attribute-mini[data-attribute-id="${id}"]`);
}

function renderCanvas() {
  const canvasStage = $('canvasStage');
  const connectionLayer = $('connectionLayer');
  const draftLayer = $('draftLayer');
  canvasStage.innerHTML = '';
  connectionLayer.innerHTML = '';
  draftLayer.innerHTML = '';

  visibleEntities.forEach((e, i) => {
    const l = entityLayout(e, i);
    const collapsed = l.collapsed !== false;
    const color = colorForDomain(e.domain.DOMAIN_CODE);
    const box = document.createElement('article');
    box.className = `canvas2-box ${collapsed ? 'collapsed' : 'expanded'} ${String(e.ENTITY_ID) === String(selectedEntityId) ? 'selected' : ''}`;
    box.dataset.entityId = e.ENTITY_ID;
    box.style.left = `${l.x}px`;
    box.style.top = `${l.y}px`;
    box.innerHTML = `<header class="canvas2-card-head" style="border-left-color:${color}"><div><h3>${e.ENTITY_NAME || e.ENTITY_CODE}</h3><p>${e.domain.DOMAIN_NAME || e.domain.DOMAIN_CODE}</p></div><button class="canvas2-toggle">${collapsed ? '+' : '-'}</button></header><div class="canvas2-card-summary"><span class="canvas2-pill">${e.attributes.length} attributes</span><span class="canvas2-pill">${e.ENTITY_CODE || ''}</span></div><section class="canvas2-card-body">${e.attributes.map(a => `<div class="canvas2-attribute-mini" data-attribute-id="${a.ATTRIBUTE_ID}" data-entity-id="${e.ENTITY_ID}"><span class="attribute-port" data-attribute-id="${a.ATTRIBUTE_ID}" data-entity-id="${e.ENTITY_ID}"></span><strong>${a.ATTRIBUTE_CODE || ''}</strong><span>${a.DATA_TYPE_NAME || a.DATA_TYPE_CODE || ''}</span></div>`).join('')}</section>`;
    canvasStage.appendChild(box);
  });

  scheduleDrawRelationships();
}

function ensureMarkers(layer) {
  let defs = layer.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    layer.appendChild(defs);
  }

  [['arrowhead', '#2563eb'], ['arrowhead-selected', '#ea580c'], ['arrowhead-draft', '#ea580c']].forEach(([id, fill]) => {
    if (!defs.querySelector('#' + id)) {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', id);
      m.setAttribute('markerWidth', '12');
      m.setAttribute('markerHeight', '8');
      m.setAttribute('refX', '10');
      m.setAttribute('refY', '4');
      m.setAttribute('orient', 'auto');
      m.setAttribute('markerUnits', 'strokeWidth');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M 0 0 L 12 4 L 0 8 z');
      p.setAttribute('fill', fill);
      m.appendChild(p);
      defs.appendChild(m);
    }
  });
}

function boxRect(box) {
  return {
    left: parseFloat(box.style.left) || 0,
    top: parseFloat(box.style.top) || 0,
    width: box.offsetWidth || 260,
    height: box.offsetHeight || 86
  };
}

function boxCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function edgePointTowards(fromRect, toRect, extraOffset = 12) {
  const from = boxCenter(fromRect);
  const to = boxCenter(toRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === 0) {
    return { x: from.x + fromRect.width / 2 + extraOffset, y: from.y };
  }

  const halfWidth = fromRect.width / 2 + extraOffset;
  const halfHeight = fromRect.height / 2 + extraOffset;
  const tx = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const ty = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const t = Math.min(tx, ty);

  return {
    x: from.x + dx * t,
    y: from.y + dy * t
  };
}

function entityRelationshipPoints(sourceEntityId, targetEntityId) {
  const sourceBox = canvasBoxElement(sourceEntityId);
  const targetBox = canvasBoxElement(targetEntityId);
  if (!sourceBox || !targetBox) return null;

  const sourceRect = boxRect(sourceBox);
  const targetRect = boxRect(targetBox);
  return {
    source: edgePointTowards(sourceRect, targetRect, 12),
    target: edgePointTowards(targetRect, sourceRect, 16)
  };
}

function drawCurve(layer, src, tgt, cls, label, id) {
  ensureMarkers(layer);

  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curve = Math.max(70, Math.min(220, distance * 0.35));
  const direction = dx >= 0 ? 1 : -1;
  const cp1x = src.x + curve * direction;
  const cp2x = tgt.x - curve * direction;
  const midX = (src.x + tgt.x) / 2;
  const midY = (src.y + tgt.y) / 2;

  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', `M ${src.x} ${src.y} C ${cp1x} ${src.y}, ${cp2x} ${tgt.y}, ${tgt.x} ${tgt.y}`);
  p.setAttribute('class', cls);
  p.setAttribute('marker-end', cls.includes('draft') ? 'url(#arrowhead-draft)' : (cls.includes('selected') ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'));
  if (id) p.dataset.relationshipId = id;
  layer.appendChild(p);

  if (label) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', midX);
    t.setAttribute('y', midY - 10);
    t.setAttribute('class', 'relationship-label');
    t.textContent = label;
    layer.appendChild(t);
  }
}

function relationshipDisplayLabel(r) {
  const sourceCode = r.SOURCE_ATTRIBUTE_CODE || '';
  const targetCode = r.TARGET_ATTRIBUTE_CODE || '';
  if (sourceCode && targetCode) return `${sourceCode} → ${targetCode}`;
  return r.RELATIONSHIP_LABEL || r.LABEL || r.RELATIONSHIP_TYPE || '';
}

function scheduleDrawRelationships() {
  if (relationshipDrawFrame) cancelAnimationFrame(relationshipDrawFrame);
  relationshipDrawFrame = requestAnimationFrame(() => {
    relationshipDrawFrame = null;
    drawRelationships();
  });
}

function drawRelationships() {
  const connectionLayer = $('connectionLayer');
  connectionLayer.innerHTML = '';

  relationships.forEach(r => {
    if (!isVisibleEntity(r.SOURCE_ENTITY_ID) || !isVisibleEntity(r.TARGET_ENTITY_ID)) return;
    const points = entityRelationshipPoints(r.SOURCE_ENTITY_ID, r.TARGET_ENTITY_ID);
    if (!points) return;
    drawCurve(
      connectionLayer,
      points.source,
      points.target,
      String(r.RELATIONSHIP_ID) === String(selectedRelationshipId) ? 'relationship-path selected' : 'relationship-path',
      relationshipDisplayLabel(r),
      r.RELATIONSHIP_ID
    );
  });
}

function pointerInStage(ev) {
  const r = $('canvasStage').getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function selectedEntity() { return allEntities.find(e => String(e.ENTITY_ID) === String(selectedEntityId)); }

function showInspector(e) {
  selectedEntityId = e.ENTITY_ID;
  selectedRelationshipId = null;
  $('inspectorTitle').textContent = e.ENTITY_NAME || e.ENTITY_CODE;
  $('inspectorSubtitle').textContent = `${e.domain.DOMAIN_NAME || e.domain.DOMAIN_CODE} · ${e.ENTITY_CODE}`;
  renderInspectorAttributes(e);
  renderCanvas();
}

function renderInspectorAttributes(e) {
  $('inspectorBody').innerHTML = `<div class="inspector-meta"><div class="detail-item"><span>Entity</span><strong>${e.ENTITY_CODE}</strong></div><div class="detail-item"><span>Attributes</span><strong>${e.attributes.length}</strong></div></div><div class="inspector-attr-list">${e.attributes.map(a => `<div class="inspector-attr-row" data-attribute-id="${a.ATTRIBUTE_ID}" data-entity-id="${e.ENTITY_ID}"><span class="attribute-port" data-attribute-id="${a.ATTRIBUTE_ID}" data-entity-id="${e.ENTITY_ID}"></span><div><strong>${a.ATTRIBUTE_CODE || ''}</strong><span>${a.ATTRIBUTE_NAME || ''} · ${a.DATA_TYPE_NAME || a.DATA_TYPE_CODE || ''}</span></div><button class="attribute-edit-button" data-attribute-id="${a.ATTRIBUTE_ID}">Edit</button></div>`).join('')}</div>`;
}

function showRelationshipInspector(r) {
  selectedRelationshipId = r.RELATIONSHIP_ID;
  selectedEntityId = null;
  $('inspectorTitle').textContent = r.RELATIONSHIP_LABEL || r.LABEL || r.RELATIONSHIP_TYPE || 'Relationship';
  $('inspectorSubtitle').textContent = 'Entity relationship. Attribute details are preserved.';
  $('inspectorBody').innerHTML = `<div class="relationship-item"><strong>Source Entity</strong><small>${r.SOURCE_ENTITY_NAME || r.SOURCE_ENTITY_CODE || r.SOURCE_ENTITY_ID}</small><strong>Source Attribute</strong><small>${r.SOURCE_ATTRIBUTE_CODE || r.SOURCE_ATTRIBUTE_ID}</small><strong>Target Entity</strong><small>${r.TARGET_ENTITY_NAME || r.TARGET_ENTITY_CODE || r.TARGET_ENTITY_ID}</small><strong>Target Attribute</strong><small>${r.TARGET_ATTRIBUTE_CODE || r.TARGET_ATTRIBUTE_ID}</small><strong>Type</strong><small>${r.RELATIONSHIP_TYPE || '-'}</small><button class="relationship-delete-button" data-relationship-id="${r.RELATIONSHIP_ID}">Delete Relationship</button></div>`;
  renderCanvas();
}

function openAttributeEdit(id) {
  const e = selectedEntity();
  if (!e) return;
  const a = e.attributes.find(x => String(x.ATTRIBUTE_ID) === String(id));
  if (!a) return;
  $('editAttributeId').value = a.ATTRIBUTE_ID;
  $('editAttributeCode').value = a.ATTRIBUTE_CODE || '';
  $('editAttributeName').value = a.ATTRIBUTE_NAME || '';
  $('editAttributeDescription').value = a.ATTRIBUTE_DESCRIPTION || '';
  $('editMaxLength').value = a.MAX_LENGTH || '';
  $('editDefaultValue').value = a.DEFAULT_VALUE || '';
  $('editIsRequired').checked = a.IS_REQUIRED === 'Y';
  $('editIsKeyAttribute').checked = a.IS_KEY_ATTRIBUTE === 'Y';
  $('editAttributeOrder').value = a.DISPLAY_ORDER || 0;
  $('attributeEditMessage').textContent = '';
  $('editDataTypeCode').innerHTML = '';
  dataTypes.forEach(dt => {
    const o = document.createElement('option');
    o.value = dt.DATA_TYPE_CODE;
    o.textContent = dt.DATA_TYPE_NAME;
    if (dt.DATA_TYPE_CODE === a.DATA_TYPE_CODE) o.selected = true;
    $('editDataTypeCode').appendChild(o);
  });
  $('attributeEditModal').classList.remove('hidden');
}

function closeAttributeEdit() { $('attributeEditModal').classList.add('hidden'); }

async function saveAttributeEdit() {
  const id = $('editAttributeId').value;
  const payload = {
    code: $('editAttributeCode').value.trim(),
    name: $('editAttributeName').value.trim(),
    description: $('editAttributeDescription').value.trim(),
    dataTypeCode: $('editDataTypeCode').value,
    maxLength: $('editMaxLength').value,
    defaultValue: $('editDefaultValue').value.trim(),
    isRequired: $('editIsRequired').checked ? 'Y' : 'N',
    isKeyAttribute: $('editIsKeyAttribute').checked ? 'Y' : 'N',
    displayOrder: $('editAttributeOrder').value
  };
  if (!payload.code || !payload.name || !payload.dataTypeCode) {
    $('attributeEditMessage').textContent = 'Code, name, and data type are required.';
    return;
  }
  try {
    await apiFetch(`/api/attributes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
    closeAttributeEdit();
    await loadModel();
    const e = selectedEntity();
    if (e) showInspector(e);
  } catch (err) {
    $('attributeEditMessage').textContent = err.data?.error || 'Unable to save the attribute.';
  }
}

function attributePointForDraft(id, side = 'right') {
  const attr = canvasAttributeElement(id);
  if (!attr) return null;
  const stageRect = $('canvasStage').getBoundingClientRect();
  const rect = attr.getBoundingClientRect();
  const offset = side === 'right' ? 10 : -10;
  return {
    x: (side === 'right' ? rect.right + offset : rect.left + offset) - stageRect.left,
    y: rect.top + rect.height / 2 - stageRect.top
  };
}

function startRelationshipDrag(ev, port) {
  const attrId = port.dataset.attributeId;
  const entityId = port.dataset.entityId;
  const srcA = allAttributes().find(a => String(a.ATTRIBUTE_ID) === String(attrId));
  const srcE = allEntities.find(e => String(e.ENTITY_ID) === String(entityId));
  if (!srcA || !srcE) return;
  relationshipDraft = {
    sourceAttribute: srcA,
    sourceEntity: srcE,
    start: attributePointForDraft(attrId, 'right') || pointerInStage(ev),
    current: pointerInStage(ev)
  };
}

function updateRelationshipDrag(ev) {
  if (!relationshipDraft) return;
  relationshipDraft.current = pointerInStage(ev);
  $('draftLayer').innerHTML = '';
  drawCurve($('draftLayer'), relationshipDraft.start, relationshipDraft.current, 'draft-path');

  const box = ev.target.closest('.canvas2-box');
  if (box) {
    if (autoExpandTimer) clearTimeout(autoExpandTimer);
    autoExpandTimer = setTimeout(() => {
      const cur = getLayout()[String(box.dataset.entityId)] || {};
      if (cur.collapsed !== false) {
        updateEntityLayout(box.dataset.entityId, { collapsed: false });
        renderCanvas();
      }
    }, 250);
  }

  document.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target'));
  const target = ev.target.closest('[data-attribute-id]');
  if (target && target.dataset.attributeId !== String(relationshipDraft.sourceAttribute.ATTRIBUTE_ID)) target.classList.add('drop-target');
}

function finishRelationshipDrag(ev) {
  if (!relationshipDraft) return;
  const targetEl = ev.target.closest('[data-attribute-id]');
  document.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target'));
  $('draftLayer').innerHTML = '';
  if (!targetEl || targetEl.dataset.attributeId === String(relationshipDraft.sourceAttribute.ATTRIBUTE_ID)) {
    relationshipDraft = null;
    return;
  }
  const targetAttribute = allAttributes().find(a => String(a.ATTRIBUTE_ID) === String(targetEl.dataset.attributeId));
  const targetEntity = allEntities.find(e => String(e.ENTITY_ID) === String(targetEl.dataset.entityId));
  if (!targetAttribute || !targetEntity) {
    relationshipDraft = null;
    return;
  }
  pendingRelationship = { ...relationshipDraft, targetAttribute, targetEntity };
  openRelationshipModal();
  relationshipDraft = null;
}

function openRelationshipModal() {
  const s = pendingRelationship.sourceAttribute;
  const t = pendingRelationship.targetAttribute;
  $('relationshipPreview').textContent = `${attributeLabel(s)} → ${attributeLabel(t)}`;
  $('relationshipLabel').value = `${s.ATTRIBUTE_CODE} → ${t.ATTRIBUTE_CODE}`;
  $('relationshipMessage').textContent = '';
  $('relationshipModal').classList.remove('hidden');
}

function hideRelationshipModal() { $('relationshipModal').classList.add('hidden'); pendingRelationship = null; }

async function savePendingRelationship() {
  showLoading('Saving relationship...', 'Persisting relationship in Oracle.');
  setButtonBusy('saveRelationship', true);
  try {
    await apiFetch('/api/relationships', {
      method: 'POST',
      body: JSON.stringify({
        versionId: currentVersionId,
        sourceEntityId: pendingRelationship.sourceEntity.ENTITY_ID,
        sourceAttributeId: pendingRelationship.sourceAttribute.ATTRIBUTE_ID,
        targetEntityId: pendingRelationship.targetEntity.ENTITY_ID,
        targetAttributeId: pendingRelationship.targetAttribute.ATTRIBUTE_ID,
        relationshipType: $('relationshipType').value,
        relationshipLabel: $('relationshipLabel').value.trim()
      })
    });
    updateLoading('Refreshing canvas relationships.');
    hideRelationshipModal();
    await loadModel();
  } catch (e) {
    $('relationshipMessage').textContent = e.data?.error || 'Unable to save the relationship.';
  } finally {
    setButtonBusy('saveRelationship', false);
    hideLoading();
  }
}

function populateManualRelationshipModal() {
  $('manualSourceAttribute').innerHTML = '';
  $('manualTargetAttribute').innerHTML = '';
  allAttributes().forEach(a => {
    const o1 = document.createElement('option');
    o1.value = a.ATTRIBUTE_ID;
    o1.textContent = attributeLabel(a);
    $('manualSourceAttribute').appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = a.ATTRIBUTE_ID;
    o2.textContent = attributeLabel(a);
    $('manualTargetAttribute').appendChild(o2);
  });
}

function openManualRelationshipModal() {
  populateManualRelationshipModal();
  $('manualRelationshipMessage').textContent = '';
  $('manualRelationshipModal').classList.remove('hidden');
}

function hideManualRelationshipModal() { $('manualRelationshipModal').classList.add('hidden'); }

async function saveManualRelationship() {
  const s = allAttributes().find(a => String(a.ATTRIBUTE_ID) === $('manualSourceAttribute').value);
  const t = allAttributes().find(a => String(a.ATTRIBUTE_ID) === $('manualTargetAttribute').value);
  if (!s || !t || s.ATTRIBUTE_ID === t.ATTRIBUTE_ID) {
    $('manualRelationshipMessage').textContent = 'Select different source and target attributes.';
    return;
  }
  showLoading('Saving relationship...', 'Persisting manual relationship in Oracle.');
  setButtonBusy('saveManualRelationship', true);
  try {
    await apiFetch('/api/relationships', {
      method: 'POST',
      body: JSON.stringify({
        versionId: currentVersionId,
        sourceEntityId: s.entity.ENTITY_ID,
        sourceAttributeId: s.ATTRIBUTE_ID,
        targetEntityId: t.entity.ENTITY_ID,
        targetAttributeId: t.ATTRIBUTE_ID,
        relationshipType: $('manualRelationshipType').value,
        relationshipLabel: $('manualRelationshipLabel').value.trim()
      })
    });
    updateLoading('Refreshing canvas relationships.');
    hideManualRelationshipModal();
    await loadModel();
  } catch (e) {
    $('manualRelationshipMessage').textContent = e.data?.error || 'Unable to save the relationship.';
  } finally {
    setButtonBusy('saveManualRelationship', false);
    hideLoading();
  }
}

async function deleteRelationship(id) {
  showLoading('Deleting relationship...', 'Removing relationship from Oracle.');
  try {
    await apiFetch(`/api/relationships/${encodeURIComponent(id)}`, { method: 'DELETE' });
    selectedRelationshipId = null;
    updateLoading('Refreshing canvas relationships.');
    await loadModel();
  } finally {
    hideLoading();
  }
}

function setupCanvasEvents() {
  const canvasStage = $('canvasStage');

  canvasStage.addEventListener('pointerdown', ev => {
    const port = ev.target.closest('.attribute-port');
    if (port) {
      startRelationshipDrag(ev, port);
      return;
    }
    const toggle = ev.target.closest('.canvas2-toggle');
    if (toggle) return;
    const box = ev.target.closest('.canvas2-box');
    if (!box) return;
    draggingBox = box;
    const pos = pointerInStage(ev);
    dragOffset.x = pos.x - parseFloat(box.style.left);
    dragOffset.y = pos.y - parseFloat(box.style.top);
    box.setPointerCapture(ev.pointerId);
    box.classList.add('dragging');
  });

  canvasStage.addEventListener('pointermove', ev => {
    if (relationshipDraft) {
      updateRelationshipDrag(ev);
      return;
    }
    if (!draggingBox) return;
    const pos = pointerInStage(ev);
    draggingBox.style.left = `${Math.max(0, pos.x - dragOffset.x)}px`;
    draggingBox.style.top = `${Math.max(0, pos.y - dragOffset.y)}px`;
    scheduleDrawRelationships();
  });

  canvasStage.addEventListener('pointerup', ev => {
    if (relationshipDraft) {
      finishRelationshipDrag(ev);
      return;
    }
    if (!draggingBox) return;
    updateEntityLayout(draggingBox.dataset.entityId, { x: parseFloat(draggingBox.style.left), y: parseFloat(draggingBox.style.top) });
    draggingBox.classList.remove('dragging');
    draggingBox = null;
    scheduleDrawRelationships();
  });

  canvasStage.addEventListener('click', ev => {
    const toggle = ev.target.closest('.canvas2-toggle');
    if (toggle) {
      const box = ev.target.closest('.canvas2-box');
      const e = visibleEntities.find(x => String(x.ENTITY_ID) === String(box.dataset.entityId));
      const cur = entityLayout(e, 0);
      updateEntityLayout(box.dataset.entityId, { collapsed: cur.collapsed === false });
      selectedEntityId = box.dataset.entityId;
      renderCanvas();
      return;
    }
    const box = ev.target.closest('.canvas2-box');
    if (!box) return;
    const e = visibleEntities.find(x => String(x.ENTITY_ID) === String(box.dataset.entityId));
    if (e) showInspector(e);
  });

  canvasStage.addEventListener('dblclick', ev => {
    const box = ev.target.closest('.canvas2-box');
    if (!box) return;
    const e = visibleEntities.find(x => String(x.ENTITY_ID) === String(box.dataset.entityId));
    if (e) location.href = `entity-detail.html?id=${encodeURIComponent(e.ENTITY_ID)}&domainId=${encodeURIComponent(e.domain.DOMAIN_ID)}&versionId=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}`;
  });

  $('connectionLayer').addEventListener('click', ev => {
    const p = ev.target.closest('.relationship-path');
    if (!p) return;
    const r = relationships.find(x => String(x.RELATIONSHIP_ID) === String(p.dataset.relationshipId));
    if (r) showRelationshipInspector(r);
  });
}

function setupViewportEvents() {
  const wrap = document.querySelector('.canvas2-stage-wrap');
  if (wrap) wrap.addEventListener('scroll', scheduleDrawRelationships, { passive: true });
  window.addEventListener('resize', scheduleDrawRelationships);
}

function setupToolbar() {
  $('backToTemplate').addEventListener('click', () => location.href = `template-detail.html?id=${encodeURIComponent(currentTemplateId)}`);
  $('domainFilter').addEventListener('change', applyFilters);
  $('canvasSearch').addEventListener('input', applyFilters);
  $('btnCollapse').addEventListener('click', () => { visibleEntities.forEach(e => updateEntityLayout(e.ENTITY_ID, { collapsed: true })); renderCanvas(); });
  $('btnExpand').addEventListener('click', () => { visibleEntities.forEach(e => updateEntityLayout(e.ENTITY_ID, { collapsed: false })); renderCanvas(); });
  $('btnReset').addEventListener('click', () => { localStorage.removeItem(storageKey()); renderCanvas(); });
  $('btnManualRelationship').addEventListener('click', openManualRelationshipModal);
  $('closeInspector').addEventListener('click', () => {
    selectedEntityId = null;
    selectedRelationshipId = null;
    $('inspectorTitle').textContent = 'Select an entity';
    $('inspectorSubtitle').textContent = 'Drag from one attribute point to another attribute.';
    $('inspectorBody').innerHTML = '<div class="empty-state">Open a box with + and drag an attribute point to another attribute to create a real relationship. You can also edit attributes from this panel.</div>';
    renderCanvas();
  });
  $('inspectorBody').addEventListener('click', ev => {
    const edit = ev.target.closest('.attribute-edit-button');
    if (edit) openAttributeEdit(edit.dataset.attributeId);
    const del = ev.target.closest('.relationship-delete-button');
    if (del) deleteRelationship(del.dataset.relationshipId);
  });
  $('closeRelationshipModal').addEventListener('click', hideRelationshipModal);
  $('cancelRelationship').addEventListener('click', hideRelationshipModal);
  $('saveRelationship').addEventListener('click', savePendingRelationship);
  $('closeManualRelationshipModal').addEventListener('click', hideManualRelationshipModal);
  $('cancelManualRelationship').addEventListener('click', hideManualRelationshipModal);
  $('saveManualRelationship').addEventListener('click', saveManualRelationship);
  $('closeAttributeEditModal').addEventListener('click', closeAttributeEdit);
  $('cancelAttributeEdit').addEventListener('click', closeAttributeEdit);
  $('saveAttributeEdit').addEventListener('click', saveAttributeEdit);
}

async function setupPage() {
  const p = getParams();
  currentTemplateId = p.templateId;
  currentVersionId = p.versionId;
  setupToolbar();
  setupCanvasEvents();
  setupViewportEvents();
  showLoading('Loading relationship canvas...', 'Preparing page.');
  try {
    updateLoading('Retrieving LOVs and data types.');
    await loadDataTypes();
    await loadRelationshipTypes();
    updateLoading('Retrieving version information.');
    await loadVersionHeader();
    await loadModel();
  } finally {
    hideLoading();
  }
}

setupPage();
