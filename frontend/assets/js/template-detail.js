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
    ? '<span class="badge badge-success">Yes</span>'
    : '<span class="badge badge-muted">No</span>';
}

function showTemplate(template) {
  document.getElementById('templateTitle').textContent = template.TEMPLATE_NAME || 'Template Details';
  document.getElementById('templateSubtitle').textContent = template.TEMPLATE_CODE || '';
  document.getElementById('templateCode').textContent = template.TEMPLATE_CODE || '-';
  document.getElementById('templateDescription').textContent = template.TEMPLATE_DESCRIPTION || 'No description';
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
  if (!versions.length) { emptyState.classList.remove('hidden'); count.textContent = '0 versions'; return; }
  emptyState.classList.add('hidden');
  count.textContent = `${versions.length} version${versions.length === 1 ? '' : 'es'}`;

  versions.forEach(v => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${v.VERSION_NUMBER}</strong></td>
      <td>${v.VERSION_LABEL || ''}</td>
      <td>${templateStatusBadge(v.VERSION_STATUS)}</td>
      <td>${yesNoBadge(v.IS_ACTIVE)}</td>
      <td>${v.CREATED_BY || ''}</td>
      <td>${v.CREATED_AT || ''}</td>
      <td>
        <button class="table-action view-version" data-version-id="${v.VERSION_ID}">View</button>
        <button class="table-action view-rel-canvas" data-version-id="${v.VERSION_ID}">Relationships</button>
      </td>`;
    tbody.appendChild(row);
  });
}

async function loadVersions() {
  const data = await apiFetch(apiPath(`/template-versions?templateId=${encodeURIComponent(currentTemplateId)}`));
  renderVersions(data.versions || []);
}

async function loadTemplateDetail() {
  currentTemplateId = getTemplateIdFromUrl();
  if (!currentTemplateId) { document.getElementById('detailError').classList.remove('hidden'); return; }
  try {
    const data = await apiFetch(apiPath('/templates'));
    const templates = getTemplatesArray(data);
    const template = templates.find(t => String(t.TEMPLATE_ID) === String(currentTemplateId));
    if (!template) { document.getElementById('detailError').classList.remove('hidden'); return; }
    showTemplate(template);
    await loadVersions();
  } catch (error) {
    document.getElementById('detailError').classList.remove('hidden');
  }
}

function openVersionModal() { document.getElementById('versionModal').classList.remove('hidden'); document.getElementById('versionLabel').focus(); }
function closeVersionModal() { document.getElementById('versionModal').classList.add('hidden'); document.getElementById('versionFormMessage').textContent = ''; }
async function saveVersion() {
  const message = document.getElementById('versionFormMessage');
  const versionLabel = document.getElementById('versionLabel').value.trim();
  message.textContent = '';
  try {
    await apiFetch(apiPath('/template-versions'), { method: 'POST', body: JSON.stringify({ templateId: currentTemplateId, versionLabel }) });
    document.getElementById('versionLabel').value = '';
    closeVersionModal();
    await loadVersions();
  } catch (error) { message.textContent = error.data?.error || 'Unable to create version.'; }
}

function setupVersionRowActions() {
  document.getElementById('versionsTable').addEventListener('click', (event) => {
    const detailButton = event.target.closest('.view-version');
    if (detailButton) { window.location.href = `version-detail.html?id=${encodeURIComponent(detailButton.dataset.versionId)}&templateId=${encodeURIComponent(currentTemplateId)}`; return; }
    const relButton = event.target.closest('.view-rel-canvas');
    if (relButton) { window.location.href = `model-canvas-relationships.html?templateId=${encodeURIComponent(currentTemplateId)}&versionId=${encodeURIComponent(relButton.dataset.versionId)}`; }
  });
}

function setupTemplateDetailPage() {
  document.getElementById('backToTemplates').addEventListener('click', () => { window.location.href = 'templates.html'; });
  document.getElementById('btnNewVersion').addEventListener('click', openVersionModal);
  document.getElementById('closeVersionModal').addEventListener('click', closeVersionModal);
  document.getElementById('cancelVersion').addEventListener('click', closeVersionModal);
  document.getElementById('saveVersion').addEventListener('click', saveVersion);
  setupVersionRowActions();
  loadTemplateDetail();
}
setupTemplateDetailPage();
