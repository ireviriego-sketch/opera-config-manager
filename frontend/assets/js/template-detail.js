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

async function loadTemplateDetail() {
  const templateId = getTemplateIdFromUrl();
  if (!templateId) {
    document.getElementById('detailError').classList.remove('hidden');
    return;
  }

  try {
    const data = await apiFetch('/api/templates');
    const templates = getTemplatesArray(data);
    const template = templates.find(t => String(t.TEMPLATE_ID) === String(templateId));
    if (!template) {
      document.getElementById('detailError').classList.remove('hidden');
      return;
    }
    showTemplate(template);
  } catch (error) {
    document.getElementById('detailError').classList.remove('hidden');
  }
}

function setupTemplateDetailPage() {
  document.getElementById('backToTemplates').addEventListener('click', () => {
    window.location.href = 'templates.html';
  });
  loadTemplateDetail();
}

setupTemplateDetailPage();
