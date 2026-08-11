let currentTemplateId = null;

function getTemplateIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function getTemplatesArray(data) {
  if (!data || !data.templates) return [];
  return Array.isArray(data.templates) ? data.templates : [data.templates];
}

function templateStatusBadge(status) {
  const value = status || 'UNKNOWN';
  const cssClass = value === 'ACTIVE' ? 'badge badge-success' : 'badge badge-muted';
  return `<span class="${cssClass}">${value}</span>`;
}

function yesNoBadge(value) {
  return value === 'Y'
    ? '<span class="badge badge-success">Sí</span>'
    : '<span class="badge badge-muted">No</span>';
}

function showTemplate(template) {
  document.getElementById('templateTitle').textContent = template.TEMPLATE_NAME || 'Detalle de plantilla';
  document.getElementById('templateSubtitle').textContent = template.TEMPLATE_CODE || '';
  document.getElementById('templateCode').textContent = template.TEMPLATE_CODE || '-';
  document.getElementById('templateDescription').textContent = template.TEMPLATE_DESCRIPTION || 'Sin descripción';
  document.getElementById('templateStatus').innerHTML = templateStatusBadge(template.STATUS);

  document.getElementById('detailId').textContent = template.TEMPLATE_ID || '-';
  document.getElementById('detailCode').textContent = template.TEMPLATE_CODE || '-';
  document.getElementById('detailName').textContent = template.TEMPLATE_NAME || '-';
  document.getElementById('detailStatus').innerHTML = templateStatusBadge(template.STATUS);
}

function renderVersions(versions) {
  const tbody = document.querySelector('#versionsTable tbody');
  const emptyState = document.getElementById('versionsEmptyState');
  const count = document.getElementById('versionsCount');

  tbody.innerHTML = '';

  if (!versions.length) {
    emptyState.classList.remove('hidden');
    count.textContent = '0 versiones';
    return;
  }

  emptyState.classList.add('hidden');
  count.textContent = `${versions.length} versión${versions.length === 1 ? '' : 'es'}`;

  versions.forEach(v => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${v.VERSION_NUMBER}</strong></td>
      <td>${v.VERSION_LABEL || ''}</td>
      <td>${templateStatusBadge(v.VERSION_STATUS)}</td>
      <td>${yesNoBadge(v.IS_ACTIVE)}</td>
      <td>${v.CREATED_BY || ''}</td>
      <td>${v.CREATED_AT || ''}</td>
    `;
    tbody.appendChild(row);
  });
}

async function loadVersions() {
  const data = await apiFetch(`/api/template-versions?templateId=${encodeURIComponent(currentTemplateId)}`);
  renderVersions(data.versions || []);
}

async function loadTemplateDetail() {
  currentTemplateId = getTemplateIdFromUrl();

  if (!currentTemplateId) {
    document.getElementById('detailError').classList.remove('hidden');
    return;
  }

  try {
    const data = await apiFetch('/api/templates');
    const templates = getTemplatesArray(data);
    const template = templates.find(t => String(t.TEMPLATE_ID) === String(currentTemplateId));

    if (!template) {
      document.getElementById('detailError').classList.remove('hidden');
      return;
    }

    showTemplate(template);
    await loadVersions();
  } catch (error) {
    document.getElementById('detailError').classList.remove('hidden');
  }
}

function openVersionModal() {
  document.getElementById('versionModal').classList.remove('hidden');
  document.getElementById('versionLabel').focus();
}

function closeVersionModal() {
  document.getElementById('versionModal').classList.add('hidden');
  document.getElementById('versionFormMessage').textContent = '';
}

async function saveVersion() {
  const message = document.getElementById('versionFormMessage');
  const versionLabel = document.getElementById('versionLabel').value.trim();

  message.textContent = '';

  try {
    await apiFetch('/api/template-versions', {
      method: 'POST',
      body: JSON.stringify({
        templateId: currentTemplateId,
        versionLabel
      })
    });

    document.getElementById('versionLabel').value = '';
    closeVersionModal();
    await loadVersions();
  } catch (error) {
    message.textContent = error.data?.error || 'No se ha podido crear la versión.';
  }
}

function setupTemplateDetailPage() {
  document.getElementById('backToTemplates').addEventListener('click', () => {
    window.location.href = 'templates.html';
  });

  document.getElementById('btnNewVersion').addEventListener('click', openVersionModal);
  document.getElementById('closeVersionModal').addEventListener('click', closeVersionModal);
  document.getElementById('cancelVersion').addEventListener('click', closeVersionModal);
  document.getElementById('saveVersion').addEventListener('click', saveVersion);

  loadTemplateDetail();
}

setupTemplateDetailPage();
