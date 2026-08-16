let currentEntityId = null;
let currentDomainId = null;
let currentVersionId = null;
let currentTemplateId = null;
let currentEntity = null;

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    entityId: params.get('id'),
    domainId: params.get('domainId'),
    versionId: params.get('versionId'),
    templateId: params.get('templateId')
  };
}

function badge(value) {
  const normalized = value || 'N';
  return normalized === 'Y'
    ? '<span class="badge badge-success">Sí</span>'
    : '<span class="badge badge-muted">No</span>';
}

function statusBadge(status) {
  const value = status || 'UNKNOWN';
  const cssClass = value === 'Y' || value === 'ACTIVE' ? 'badge badge-success' : 'badge badge-muted';
  return `<span class="${cssClass}">${value}</span>`;
}

function showEntity(entity) {
  document.getElementById('entityTitle').textContent = entity.ENTITY_NAME || 'Detalle de entidad';
  document.getElementById('entitySubtitle').textContent = entity.ENTITY_CODE || '';
  document.getElementById('entityCode').textContent = entity.ENTITY_CODE || '-';
  document.getElementById('entityDescription').textContent = entity.ENTITY_DESCRIPTION || 'Sin descripción';
  document.getElementById('entityStatus').innerHTML = statusBadge(entity.IS_ACTIVE);
}

function renderAttributes(attributes) {
  const tbody = document.querySelector('#attributesTable tbody');
  const emptyState = document.getElementById('attributesEmptyState');
  const count = document.getElementById('attributesCount');

  tbody.innerHTML = '';

  if (!attributes.length) {
    emptyState.classList.remove('hidden');
    count.textContent = '0 atributos';
    return;
  }

  emptyState.classList.add('hidden');
  count.textContent = `${attributes.length} atributo${attributes.length === 1 ? '' : 's'}`;

  attributes.forEach(a => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${a.ATTRIBUTE_CODE || ''}</strong></td>
      <td>${a.ATTRIBUTE_NAME || ''}</td>
      <td>${a.DATA_TYPE_NAME || a.DATA_TYPE_CODE || ''}</td>
      <td>${badge(a.IS_REQUIRED)}</td>
      <td>${badge(a.IS_KEY_ATTRIBUTE)}</td>
      <td>${a.MAX_LENGTH || ''}</td>
      <td>${a.DISPLAY_ORDER || 0}</td>
    `;
    tbody.appendChild(row);
  });
}

async function loadEntity() {
  const data = await apiFetch(`/api/entities?domainId=${encodeURIComponent(currentDomainId)}`);
  const entities = data.entities || [];
  currentEntity = entities.find(e => String(e.ENTITY_ID) === String(currentEntityId));
  if (currentEntity) showEntity(currentEntity);
}

async function loadAttributes() {
  const data = await apiFetch(`/api/attributes?entityId=${encodeURIComponent(currentEntityId)}`);
  renderAttributes(data.attributes || []);
}

async function loadDataTypes() {
  const select = document.getElementById('dataTypeCode');
  select.innerHTML = '';
  const dataTypes = window.LovsClient ? await window.LovsClient.dataTypes() : (await apiFetch('/api/attributes/data-types')).dataTypes || [];
  dataTypes.forEach(dt => {
    const option = document.createElement('option');
    option.value = dt.DATA_TYPE_CODE;
    option.textContent = dt.DATA_TYPE_NAME;
    select.appendChild(option);
  });
}

async function loadPage() {
  const params = getParams();
  currentEntityId = params.entityId;
  currentDomainId = params.domainId;
  currentVersionId = params.versionId;
  currentTemplateId = params.templateId;

  await loadEntity();
  await loadDataTypes();
  await loadAttributes();
}

function openAttributeModal() {
  document.getElementById('attributeModal').classList.remove('hidden');
  document.getElementById('attributeCode').focus();
}

function closeAttributeModal() {
  document.getElementById('attributeModal').classList.add('hidden');
  document.getElementById('attributeFormMessage').textContent = '';
}

function clearAttributeForm() {
  document.getElementById('attributeCode').value = '';
  document.getElementById('attributeName').value = '';
  document.getElementById('attributeDescription').value = '';
  document.getElementById('maxLength').value = '';
  document.getElementById('defaultValue').value = '';
  document.getElementById('isRequired').checked = false;
  document.getElementById('isKeyAttribute').checked = false;
  document.getElementById('attributeOrder').value = '0';
}

async function saveAttribute() {
  const message = document.getElementById('attributeFormMessage');
  const code = document.getElementById('attributeCode').value.trim();
  const name = document.getElementById('attributeName').value.trim();
  const description = document.getElementById('attributeDescription').value.trim();
  const dataTypeCode = document.getElementById('dataTypeCode').value;
  const maxLength = document.getElementById('maxLength').value;
  const defaultValue = document.getElementById('defaultValue').value.trim();
  const isRequired = document.getElementById('isRequired').checked ? 'Y' : 'N';
  const isKeyAttribute = document.getElementById('isKeyAttribute').checked ? 'Y' : 'N';
  const displayOrder = document.getElementById('attributeOrder').value;

  message.textContent = '';

  if (!code || !name || !dataTypeCode) {
    message.textContent = 'Código, nombre y tipo de dato son obligatorios.';
    return;
  }

  try {
    await apiFetch('/api/attributes', {
      method: 'POST',
      body: JSON.stringify({
        entityId: currentEntityId,
        code,
        name,
        description,
        dataTypeCode,
        maxLength,
        defaultValue,
        isRequired,
        isKeyAttribute,
        displayOrder
      })
    });

    clearAttributeForm();
    closeAttributeModal();
    await loadAttributes();
  } catch (error) {
    message.textContent = error.data?.error || 'No se ha podido guardar el atributo.';
  }
}

function setupEntityDetailPage() {
  document.getElementById('backToDomain').addEventListener('click', () => {
    window.location.href = `domain-detail.html?id=${encodeURIComponent(currentDomainId)}&versionId=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}`;
  });

  document.getElementById('btnNewAttribute').addEventListener('click', openAttributeModal);
  document.getElementById('closeAttributeModal').addEventListener('click', closeAttributeModal);
  document.getElementById('cancelAttribute').addEventListener('click', closeAttributeModal);
  document.getElementById('saveAttribute').addEventListener('click', saveAttribute);

  loadPage();
}

setupEntityDetailPage();
