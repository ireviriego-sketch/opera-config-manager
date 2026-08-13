let currentTemplateId = null;
let currentVersionId = null;
let model = [];
let entities = [];
let filteredEntities = [];
let dragging = null;
let dragOffset = { x: 0, y: 0 };
let zoom = 1;

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    templateId: params.get('templateId'),
    versionId: params.get('versionId')
  };
}

function storageKey() {
  return `operaCanvasLayout:v${currentVersionId}`;
}

function loadStoredLayout() {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || '{}');
  } catch (error) {
    return {};
  }
}

function saveStoredLayout(layout) {
  localStorage.setItem(storageKey(), JSON.stringify(layout));
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function matchesSearch(entity, search) {
  if (!search) return true;
  if (normalizeText(entity.ENTITY_CODE).includes(search)) return true;
  if (normalizeText(entity.ENTITY_NAME).includes(search)) return true;
  if (normalizeText(entity.ENTITY_DESCRIPTION).includes(search)) return true;
  return entity.attributes.some(attribute =>
    normalizeText(attribute.ATTRIBUTE_CODE).includes(search)
    || normalizeText(attribute.ATTRIBUTE_NAME).includes(search)
    || normalizeText(attribute.DATA_TYPE_NAME).includes(search)
  );
}

function domainColor(domainCode) {
  const colors = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];
  let hash = 0;
  String(domainCode || '').split('').forEach(char => { hash = ((hash << 5) - hash) + char.charCodeAt(0); });
  return colors[Math.abs(hash) % colors.length];
}

async function loadVersionHeader() {
  const data = await apiFetch(`/api/template-versions?templateId=${encodeURIComponent(currentTemplateId)}`);
  const version = (data.versions || []).find(v => String(v.VERSION_ID) === String(currentVersionId));
  if (!version) return;
  document.getElementById('canvasVersionTitle').textContent = version.VERSION_LABEL || `Versión ${version.VERSION_NUMBER}`;
}

async function loadModel() {
  const domainsData = await apiFetch(`/api/domains?versionId=${encodeURIComponent(currentVersionId)}`);
  const domains = domainsData.domains || [];
  const allEntities = [];

  for (const domain of domains) {
    const entitiesData = await apiFetch(`/api/entities?domainId=${encodeURIComponent(domain.DOMAIN_ID)}`);
    const domainEntities = entitiesData.entities || [];

    for (const entity of domainEntities) {
      const attrsData = await apiFetch(`/api/attributes?entityId=${encodeURIComponent(entity.ENTITY_ID)}`);
      allEntities.push({
        ...entity,
        domain,
        attributes: attrsData.attributes || []
      });
    }
  }

  model = domains;
  entities = allEntities;
  populateDomainFilter();
  applyFilters();
  updateStats();
}

function populateDomainFilter() {
  const select = document.getElementById('domainFilter');
  select.innerHTML = '<option value="ALL">Todos los dominios</option>';
  model.forEach(domain => {
    const option = document.createElement('option');
    option.value = String(domain.DOMAIN_ID);
    option.textContent = domain.DOMAIN_NAME || domain.DOMAIN_CODE;
    select.appendChild(option);
  });
}

function updateStats() {
  const attrCount = entities.reduce((total, entity) => total + entity.attributes.length, 0);
  document.getElementById('canvasStats').textContent = `${model.length} dominios · ${entities.length} entidades · ${attrCount} atributos`;
}

function applyFilters() {
  const domainId = document.getElementById('domainFilter').value;
  const search = document.getElementById('canvasSearch').value.trim().toLowerCase();

  filteredEntities = entities.filter(entity => {
    const domainOk = domainId === 'ALL' || String(entity.domain.DOMAIN_ID) === domainId;
    return domainOk && matchesSearch(entity, search);
  });

  renderCanvas();
}

function initialPosition(index, domainIndex) {
  const cols = 4;
  const x = 40 + (index % cols) * 330;
  const y = 40 + Math.floor(index / cols) * 250 + domainIndex * 20;
  return { x, y };
}

function getEntityPosition(entity, index) {
  const layout = loadStoredLayout();
  const saved = layout[String(entity.ENTITY_ID)];
  if (saved) return saved;
  const domainIndex = model.findIndex(domain => String(domain.DOMAIN_ID) === String(entity.domain.DOMAIN_ID));
  return initialPosition(index, Math.max(domainIndex, 0));
}

function setEntityPosition(entityId, x, y) {
  const layout = loadStoredLayout();
  layout[String(entityId)] = {
    ...(layout[String(entityId)] || {}),
    x,
    y
  };
  saveStoredLayout(layout);
}

function isCollapsed(entityId) {
  const layout = loadStoredLayout();
  const saved = layout[String(entityId)];
  return saved ? saved.collapsed !== false : true;
}

function setCollapsed(entityId, collapsed) {
  const layout = loadStoredLayout();
  layout[String(entityId)] = {
    ...(layout[String(entityId)] || {}),
    collapsed
  };
  saveStoredLayout(layout);
}

function renderCanvas() {
  const grid = document.getElementById('canvasGrid');
  const svg = document.getElementById('canvasLinks');
  grid.innerHTML = '';
  svg.innerHTML = '';

  filteredEntities.forEach((entity, index) => {
    const pos = getEntityPosition(entity, index);
    const collapsed = isCollapsed(entity.ENTITY_ID);
    const color = domainColor(entity.domain.DOMAIN_CODE);
    const box = document.createElement('article');
    box.className = `canvas-box ${collapsed ? 'collapsed' : ''}`;
    box.dataset.entityId = entity.ENTITY_ID;
    box.style.left = `${pos.x}px`;
    box.style.top = `${pos.y}px`;
    box.innerHTML = `
      <header class="canvas-box-header" style="border-left-color:${color}">
        <div>
          <h3>${entity.ENTITY_NAME || entity.ENTITY_CODE}</h3>
          <p>${entity.domain.DOMAIN_NAME || entity.domain.DOMAIN_CODE}</p>
        </div>
        <button class="box-toggle" title="Expandir o colapsar">${collapsed ? '+' : '-'}</button>
      </header>
      <section class="canvas-box-body">
        <div class="canvas-box-meta">
          <span>${entity.ENTITY_CODE || ''}</span>
          <span>${entity.attributes.length} atributos</span>
        </div>
        <div class="canvas-attributes">
          ${entity.attributes.slice(0, 20).map(attribute => `
            <div class="canvas-attribute-row">
              <strong>${attribute.ATTRIBUTE_CODE || ''}</strong>
              <span>${attribute.DATA_TYPE_NAME || attribute.DATA_TYPE_CODE || ''}</span>
            </div>
          `).join('')}
        </div>
      </section>
    `;
    grid.appendChild(box);
  });

  drawDomainGuides();
}

function drawDomainGuides() {
  const svg = document.getElementById('canvasLinks');
  const boxes = Array.from(document.querySelectorAll('.canvas-box'));
  const byDomain = new Map();

  boxes.forEach(box => {
    const entity = filteredEntities.find(e => String(e.ENTITY_ID) === String(box.dataset.entityId));
    if (!entity) return;
    const key = String(entity.domain.DOMAIN_ID);
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key).push({ box, entity });
  });

  byDomain.forEach(items => {
    if (items.length < 2) return;
    const sorted = items.slice().sort((a, b) => parseFloat(a.box.style.left) - parseFloat(b.box.style.left));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i].box.getBoundingClientRect();
      const b = sorted[i + 1].box.getBoundingClientRect();
      const parent = document.querySelector('.canvas-shell').getBoundingClientRect();
      const x1 = a.right - parent.left;
      const y1 = a.top + a.height / 2 - parent.top;
      const x2 = b.left - parent.left;
      const y2 = b.top + b.height / 2 - parent.top;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = (x1 + x2) / 2;
      line.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
      line.setAttribute('class', 'canvas-guide-line');
      svg.appendChild(line);
    }
  });
}

function pointerPosition(event) {
  const shell = document.querySelector('.canvas-shell').getBoundingClientRect();
  return {
    x: event.clientX - shell.left,
    y: event.clientY - shell.top
  };
}

function setupDrag() {
  const grid = document.getElementById('canvasGrid');
  grid.addEventListener('pointerdown', event => {
    const toggle = event.target.closest('.box-toggle');
    if (toggle) return;
    const box = event.target.closest('.canvas-box');
    if (!box) return;

    dragging = box;
    const pos = pointerPosition(event);
    dragOffset.x = pos.x - parseFloat(box.style.left);
    dragOffset.y = pos.y - parseFloat(box.style.top);
    box.setPointerCapture(event.pointerId);
    box.classList.add('dragging');
  });

  grid.addEventListener('pointermove', event => {
    if (!dragging) return;
    const pos = pointerPosition(event);
    const x = Math.max(0, pos.x - dragOffset.x);
    const y = Math.max(0, pos.y - dragOffset.y);
    dragging.style.left = `${x}px`;
    dragging.style.top = `${y}px`;
    drawDomainGuides();
  });

  grid.addEventListener('pointerup', event => {
    if (!dragging) return;
    setEntityPosition(dragging.dataset.entityId, parseFloat(dragging.style.left), parseFloat(dragging.style.top));
    dragging.classList.remove('dragging');
    dragging = null;
  });

  grid.addEventListener('click', event => {
    const toggle = event.target.closest('.box-toggle');
    if (!toggle) return;
    const box = event.target.closest('.canvas-box');
    const id = box.dataset.entityId;
    setCollapsed(id, !isCollapsed(id));
    renderCanvas();
  });

  grid.addEventListener('dblclick', event => {
    const box = event.target.closest('.canvas-box');
    if (!box) return;
    const entity = filteredEntities.find(e => String(e.ENTITY_ID) === String(box.dataset.entityId));
    if (!entity) return;
    window.location.href = `entity-detail.html?id=${encodeURIComponent(entity.ENTITY_ID)}&domainId=${encodeURIComponent(entity.domain.DOMAIN_ID)}&versionId=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}`;
  });
}

function setupToolbar() {
  document.getElementById('backToTemplate').addEventListener('click', () => {
    window.location.href = `template-detail.html?id=${encodeURIComponent(currentTemplateId)}`;
  });
  document.getElementById('domainFilter').addEventListener('change', applyFilters);
  document.getElementById('canvasSearch').addEventListener('input', applyFilters);
  document.getElementById('collapseAllBoxes').addEventListener('click', () => {
    filteredEntities.forEach(e => setCollapsed(e.ENTITY_ID, true));
    renderCanvas();
  });
  document.getElementById('expandAllBoxes').addEventListener('click', () => {
    filteredEntities.forEach(e => setCollapsed(e.ENTITY_ID, false));
    renderCanvas();
  });
  document.getElementById('resetLayout').addEventListener('click', () => {
    localStorage.removeItem(storageKey());
    renderCanvas();
  });
  document.getElementById('exportCanvasJson').addEventListener('click', () => {
    const payload = {
      templateId: currentTemplateId,
      versionId: currentVersionId,
      layout: loadStoredLayout(),
      visibleEntityIds: filteredEntities.map(e => e.ENTITY_ID)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opera-model-canvas-v${currentVersionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function setupCanvasPage() {
  const params = getParams();
  currentTemplateId = params.templateId;
  currentVersionId = params.versionId;

  if (!currentTemplateId || !currentVersionId) {
    document.getElementById('canvasStats').textContent = 'Faltan parámetros templateId y versionId.';
    return;
  }

  setupToolbar();
  setupDrag();
  await loadVersionHeader();
  await loadModel();
}

setupCanvasPage();
