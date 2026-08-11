let currentDomainId = null;
let currentVersionId = null;
let currentTemplateId = null;
let currentDomain = null;

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    domainId: params.get('id'),
    versionId: params.get('versionId'),
    templateId: params.get('templateId')
  };
}

function statusBadge(status) {
  const value = status || 'UNKNOWN';
  const cssClass = value === 'Y' || value === 'ACTIVE' ? 'badge badge-success' : 'badge badge-muted';
  return `<span class="${cssClass}">${value}</span>`;
}

function showDomain(domain) {
  document.getElementById('domainTitle').textContent = domain.DOMAIN_NAME || 'Detalle de dominio';
  document.getElementById('domainSubtitle').textContent = domain.DOMAIN_CODE || '';
  document.getElementById('domainCode').textContent = domain.DOMAIN_CODE || '-';
  document.getElementById('domainDescription').textContent = domain.DOMAIN_DESCRIPTION || 'Sin descripción';
}

function renderEntities(entities) {
  const tbody = document.querySelector('#entitiesTable tbody');
  const emptyState = document.getElementById('entitiesEmptyState');
  const count = document.getElementById('entitiesCount');

  tbody.innerHTML = '';

  if (!entities.length) {
    emptyState.classList.remove('hidden');
    count.textContent = '0 entidades';
    return;
  }

  emptyState.classList.add('hidden');
  count.textContent = `${entities.length} entidad${entities.length === 1 ? '' : 'es'}`;

  entities.forEach(e => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${e.ENTITY_CODE || ''}</strong></td>
      <td>${e.ENTITY_NAME || ''}</td>
      <td>${e.ENTITY_DESCRIPTION || ''}</td>
      <td>${e.SOURCE_SECTION_NAME || ''}</td>
      <td>${e.DISPLAY_ORDER || 0}</td>
      <td>${statusBadge(e.IS_ACTIVE)}</td>
      <td><button class="table-action view-entity" data-entity-id="${e.ENTITY_ID}">Ver</button></td>
    `;
    tbody.appendChild(row);
  });
}

async function loadDomain() {
  const data = await apiFetch(`/api/domains?versionId=${encodeURIComponent(currentVersionId)}`);
  const domains = data.domains || [];
  currentDomain = domains.find(d => String(d.DOMAIN_ID) === String(currentDomainId));
  if (currentDomain) showDomain(currentDomain);
}

async function loadEntities() {
  const data = await apiFetch(`/api/entities?domainId=${encodeURIComponent(currentDomainId)}`);
  renderEntities(data.entities || []);
}

async function loadPage() {
  const params = getParams();
  currentDomainId = params.domainId;
  currentVersionId = params.versionId;
  currentTemplateId = params.templateId;

  await loadDomain();
  await loadEntities();
}

function openEntityModal() {
  document.getElementById('entityModal').classList.remove('hidden');
  document.getElementById('entityCode').focus();
}

function closeEntityModal() {
  document.getElementById('entityModal').classList.add('hidden');
  document.getElementById('entityFormMessage').textContent = '';
}

function clearEntityForm() {
  document.getElementById('entityCode').value = '';
  document.getElementById('entityName').value = '';
  document.getElementById('entityDescription').value = '';
  document.getElementById('sourceSectionName').value = '';
  document.getElementById('entityOrder').value = '0';
}

async function saveEntity() {
  const message = document.getElementById('entityFormMessage');
  const code = document.getElementById('entityCode').value.trim();
  const name = document.getElementById('entityName').value.trim();
  const description = document.getElementById('entityDescription').value.trim();
  const sourceSectionName = document.getElementById('sourceSectionName').value.trim();
  const displayOrder = document.getElementById('entityOrder').value;

  message.textContent = '';

  if (!code || !name) {
    message.textContent = 'Código y nombre son obligatorios.';
    return;
  }

  try {
    await apiFetch('/api/entities', {
      method: 'POST',
      body: JSON.stringify({
        domainId: currentDomainId,
        code,
        name,
        description,
        sourceSectionName,
        displayOrder
      })
    });

    clearEntityForm();
    closeEntityModal();
    await loadEntities();
  } catch (error) {
    message.textContent = error.data?.error || 'No se ha podido guardar la entidad.';
  }
}

function setupEntityRowActions() {
  document.getElementById('entitiesTable').addEventListener('click', (event) => {
    const button = event.target.closest('.view-entity');
    if (!button) return;
    window.location.href = `entity-detail.html?id=${encodeURIComponent(button.dataset.entityId)}&domainId=${encodeURIComponent(currentDomainId)}&versionId=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}`;
  });
}

function setupDomainDetailPage() {
  document.getElementById('backToVersion').addEventListener('click', () => {
    window.location.href = `version-detail.html?id=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}`;
  });

  document.getElementById('btnNewEntity').addEventListener('click', openEntityModal);
  document.getElementById('closeEntityModal').addEventListener('click', closeEntityModal);
  document.getElementById('cancelEntity').addEventListener('click', closeEntityModal);
  document.getElementById('saveEntity').addEventListener('click', saveEntity);
  setupEntityRowActions();

  loadPage();
}

setupDomainDetailPage();
