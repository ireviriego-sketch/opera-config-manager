let currentTemplateId = null;
let currentVersionId = null;
let model = [];
let expandedDomains = new Set();
let expandedEntities = new Set();

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    templateId: params.get('templateId'),
    versionId: params.get('versionId')
  };
}

function statusBadge(status) {
  const value = status || 'UNKNOWN';
  const cssClass = value === 'ACTIVE' || value === 'Y' ? 'badge badge-success' : 'badge badge-muted';
  return `<span class="${cssClass}">${value}</span>`;
}

function textMatches(value, search) {
  return String(value || '').toLowerCase().includes(search);
}

async function loadVersionHeader() {
  const data = await apiFetch(`/api/template-versions?templateId=${encodeURIComponent(currentTemplateId)}`);
  const version = (data.versions || []).find(v => String(v.VERSION_ID) === String(currentVersionId));
  if (!version) return;

  document.getElementById('versionTitle').textContent = version.VERSION_LABEL || `Versión ${version.VERSION_NUMBER}`;
  document.getElementById('visualSubtitle').textContent = `Versión ${version.VERSION_NUMBER} · ${version.VERSION_STATUS}`;
}

async function loadModel() {
  const domainsData = await apiFetch(`/api/domains?versionId=${encodeURIComponent(currentVersionId)}`);
  const domains = domainsData.domains || [];

  const modelItems = [];
  for (const domain of domains) {
    const entitiesData = await apiFetch(`/api/entities?domainId=${encodeURIComponent(domain.DOMAIN_ID)}`);
    const entities = entitiesData.entities || [];

    const entityItems = [];
    for (const entity of entities) {
      const attrsData = await apiFetch(`/api/attributes?entityId=${encodeURIComponent(entity.ENTITY_ID)}`);
      entityItems.push({
        ...entity,
        attributes: attrsData.attributes || []
      });
    }

    modelItems.push({
      ...domain,
      entities: entityItems
    });
  }

  model = modelItems;
  model.forEach(d => expandedDomains.add(String(d.DOMAIN_ID)));
  updateStats();
  renderModel();
}

function updateStats() {
  const domainCount = model.length;
  const entityCount = model.reduce((total, d) => total + d.entities.length, 0);
  const attributeCount = model.reduce((total, d) => total + d.entities.reduce((subtotal, e) => subtotal + e.attributes.length, 0), 0);

  document.getElementById('domainCount').textContent = domainCount;
  document.getElementById('entityCount').textContent = entityCount;
  document.getElementById('attributeCount').textContent = attributeCount;
  document.getElementById('modelSummary').textContent = `${domainCount} dominios · ${entityCount} entidades · ${attributeCount} atributos`;
}

function filteredModel() {
  const search = document.getElementById('modelSearch').value.trim().toLowerCase();
  if (!search) return model;

  return model.map(domain => {
    const domainMatch = textMatches(domain.DOMAIN_CODE, search) || textMatches(domain.DOMAIN_NAME, search) || textMatches(domain.DOMAIN_DESCRIPTION, search);

    const entities = domain.entities.map(entity => {
      const entityMatch = textMatches(entity.ENTITY_CODE, search) || textMatches(entity.ENTITY_NAME, search) || textMatches(entity.ENTITY_DESCRIPTION, search);
      const attributes = entity.attributes.filter(attribute =>
        textMatches(attribute.ATTRIBUTE_CODE, search)
        || textMatches(attribute.ATTRIBUTE_NAME, search)
        || textMatches(attribute.ATTRIBUTE_DESCRIPTION, search)
        || textMatches(attribute.DATA_TYPE_NAME, search)
      );

      if (domainMatch || entityMatch || attributes.length) {
        return {
          ...entity,
          attributes: domainMatch || entityMatch ? entity.attributes : attributes
        };
      }

      return null;
    }).filter(Boolean);

    if (domainMatch || entities.length) {
      return {
        ...domain,
        entities: domainMatch ? domain.entities : entities
      };
    }

    return null;
  }).filter(Boolean);
}

function renderModel() {
  const container = document.getElementById('modelExplorer');
  const emptyState = document.getElementById('visualEmptyState');
  const items = filteredModel();

  container.innerHTML = '';

  if (!items.length) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  items.forEach(domain => {
    const domainId = String(domain.DOMAIN_ID);
    const domainExpanded = expandedDomains.has(domainId);

    const domainBlock = document.createElement('article');
    domainBlock.className = 'explorer-domain';
    domainBlock.innerHTML = `
      <button class="explorer-domain-header" data-domain-id="${domain.DOMAIN_ID}">
        <span>${domainExpanded ? '▾' : '▸'}</span>
        <strong>${domain.DOMAIN_NAME || domain.DOMAIN_CODE}</strong>
        <em>${domain.entities.length} entidades</em>
      </button>
      <div class="explorer-domain-body ${domainExpanded ? '' : 'hidden'}"></div>
    `;

    const body = domainBlock.querySelector('.explorer-domain-body');

    domain.entities.forEach(entity => {
      const entityKey = String(entity.ENTITY_ID);
      const entityExpanded = expandedEntities.has(entityKey);
      const entityBlock = document.createElement('div');
      entityBlock.className = 'explorer-entity';
      entityBlock.innerHTML = `
        <div class="explorer-entity-header">
          <button class="entity-toggle" data-entity-id="${entity.ENTITY_ID}">${entityExpanded ? '▾' : '▸'}</button>
          <div>
            <a href="entity-detail.html?id=${encodeURIComponent(entity.ENTITY_ID)}&domainId=${encodeURIComponent(domain.DOMAIN_ID)}&versionId=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}">
              <strong>${entity.ENTITY_NAME || entity.ENTITY_CODE}</strong>
            </a>
            <p>${entity.ENTITY_CODE || ''}</p>
          </div>
          <span class="badge badge-muted">${entity.attributes.length} atributos</span>
        </div>
        <div class="explorer-attributes ${entityExpanded ? '' : 'hidden'}"></div>
      `;

      const attrs = entityBlock.querySelector('.explorer-attributes');
      entity.attributes.forEach(attribute => {
        const attr = document.createElement('div');
        attr.className = 'explorer-attribute';
        attr.innerHTML = `
          <strong>${attribute.ATTRIBUTE_CODE || ''}</strong>
          <span>${attribute.ATTRIBUTE_NAME || ''}</span>
          <em>${attribute.DATA_TYPE_NAME || attribute.DATA_TYPE_CODE || ''}</em>
        `;
        attrs.appendChild(attr);
      });

      body.appendChild(entityBlock);
    });

    container.appendChild(domainBlock);
  });
}

function setupEvents() {
  document.getElementById('backToTemplate').addEventListener('click', () => {
    window.location.href = `template-detail.html?id=${encodeURIComponent(currentTemplateId)}`;
  });

  document.getElementById('modelSearch').addEventListener('input', renderModel);

  document.getElementById('expandAll').addEventListener('click', () => {
    model.forEach(d => {
      expandedDomains.add(String(d.DOMAIN_ID));
      d.entities.forEach(e => expandedEntities.add(String(e.ENTITY_ID)));
    });
    renderModel();
  });

  document.getElementById('collapseAll').addEventListener('click', () => {
    expandedDomains.clear();
    expandedEntities.clear();
    renderModel();
  });

  document.getElementById('modelExplorer').addEventListener('click', event => {
    const domainButton = event.target.closest('.explorer-domain-header');
    if (domainButton) {
      const id = String(domainButton.dataset.domainId);
      expandedDomains.has(id) ? expandedDomains.delete(id) : expandedDomains.add(id);
      renderModel();
      return;
    }

    const entityButton = event.target.closest('.entity-toggle');
    if (entityButton) {
      const id = String(entityButton.dataset.entityId);
      expandedEntities.has(id) ? expandedEntities.delete(id) : expandedEntities.add(id);
      renderModel();
    }
  });
}

async function setupTemplateVisualPage() {
  const params = getParams();
  currentTemplateId = params.templateId;
  currentVersionId = params.versionId;

  if (!currentTemplateId || !currentVersionId) {
    document.getElementById('modelSummary').textContent = 'Faltan parámetros templateId y versionId.';
    return;
  }

  setupEvents();
  await loadVersionHeader();
  await loadModel();
}

setupTemplateVisualPage();
