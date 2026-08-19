let allTemplates = [];

function getTemplatesArray(data) {
  if (!data || !data.templates) return [];
  return Array.isArray(data.templates) ? data.templates : [data.templates];
}

function templateStatusBadge(status) {
  const value = status || 'UNKNOWN';
  const cssClass = value === 'ACTIVE' ? 'badge badge-success' : 'badge badge-muted';
  return `<span class="${cssClass}">${value}</span>`;
}

function renderTemplates(templates) {
  const tbody = document.querySelector('#templatesTable tbody');
  const emptyState = document.getElementById('emptyState');
  const templateCount = document.getElementById('templateCount');
  tbody.innerHTML = '';

  if (!templates.length) {
    emptyState.classList.remove('hidden');
    templateCount.textContent = '0 plantillas';
    return;
  }

  emptyState.classList.add('hidden');
  templateCount.textContent = `${templates.length} plantilla${templates.length === 1 ? '' : 's'}`;

  templates.forEach(t => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${t.TEMPLATE_CODE || ''}</strong></td>
      <td>${t.TEMPLATE_NAME || ''}</td>
      <td>${t.TEMPLATE_DESCRIPTION || ''}</td>
      <td>${templateStatusBadge(t.STATUS)}</td>
      <td><button class="table-action view-template" data-template-id="${t.TEMPLATE_ID}">View</button></td>
    `;
    tbody.appendChild(row);
  });
}

async function loadTemplates() {
  const data = await apiFetch(apiPath('/templates'));
  allTemplates = getTemplatesArray(data);
  applyTemplateFilter();
}

function applyTemplateFilter() {
  const search = document.getElementById('templateSearch').value.trim().toLowerCase();
  const filtered = allTemplates.filter(t =>
    String(t.TEMPLATE_CODE || '').toLowerCase().includes(search)
    || String(t.TEMPLATE_NAME || '').toLowerCase().includes(search)
    || String(t.TEMPLATE_DESCRIPTION || '').toLowerCase().includes(search)
  );
  renderTemplates(filtered);
}

function openTemplateModal() {
  document.getElementById('templateModal').classList.remove('hidden');
  document.getElementById('code').focus();
}

function closeTemplateModal() {
  document.getElementById('templateModal').classList.add('hidden');
  document.getElementById('templateFormMessage').textContent = '';
}

function clearTemplateForm() {
  document.getElementById('code').value = '';
  document.getElementById('name').value = '';
  document.getElementById('description').value = '';
}

async function saveTemplate() {
  const message = document.getElementById('templateFormMessage');
  const code = document.getElementById('code').value.trim();
  const name = document.getElementById('name').value.trim();
  const description = document.getElementById('description').value.trim();
  message.textContent = '';

  if (!code || !name) {
    message.textContent = 'Code and name are required.';
    return;
  }

  try {
    await apiFetch(apiPath('/templates'), {
      method: 'POST',
      body: JSON.stringify({ code, name, description })
    });
    clearTemplateForm();
    closeTemplateModal();
    await loadTemplates();
  } catch (error) {
    message.textContent = error.data?.error || 'Unable to save template.';
  }
}

function setupTemplateRowActions() {
  document.getElementById('templatesTable').addEventListener('click', (event) => {
    const button = event.target.closest('.view-template');
    if (!button) return;
    window.location.href = `template-detail.html?id=${encodeURIComponent(button.dataset.templateId)}`;
  });
}

function setupTemplatesPage() {
  document.getElementById('btnNewTemplate').addEventListener('click', openTemplateModal);
  document.getElementById('closeTemplateModal').addEventListener('click', closeTemplateModal);
  document.getElementById('cancelTemplate').addEventListener('click', closeTemplateModal);
  document.getElementById('saveTemplate').addEventListener('click', saveTemplate);
  document.getElementById('templateSearch').addEventListener('input', applyTemplateFilter);
  setupTemplateRowActions();
  loadTemplates();
}

setupTemplatesPage();
