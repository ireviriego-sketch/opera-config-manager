let currentVersionId = null;
let currentTemplateId = null;
let currentVersion = null;

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    versionId: params.get('id'),
    templateId: params.get('templateId')
  };
}

function statusBadge(status) {
  const value = status || 'UNKNOWN';
  const cssClass = value === 'ACTIVE' ? 'badge badge-success' : 'badge badge-muted';
  return `<span class="${cssClass}">${value}</span>`;
}

function showVersion(version) {
  const label = version.VERSION_LABEL || `Version ${version.VERSION_NUMBER}`;
  document.getElementById('versionTitle').textContent = label;
  document.getElementById('versionSubtitle').textContent = `Version ${version.VERSION_NUMBER}`;
  document.getElementById('versionCode').textContent = `Version ${version.VERSION_NUMBER}`;
  document.getElementById('versionDescription').textContent = version.VERSION_LABEL || 'No label';
  document.getElementById('versionStatus').innerHTML = statusBadge(version.VERSION_STATUS);
}

function renderDomains(domains) {
  const tbody = document.querySelector('#domainsTable tbody');
  const emptyState = document.getElementById('domainsEmptyState');
  const count = document.getElementById('domainsCount');

  tbody.innerHTML = '';

  if (!domains.length) {
    emptyState.classList.remove('hidden');
    count.textContent = '0 domains';
    return;
  }

  emptyState.classList.add('hidden');
  count.textContent = `${domains.length} domain${domains.length === 1 ? '' : 's'}`;

  domains.forEach(d => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${d.DOMAIN_CODE || ''}</strong></td>
      <td>${d.DOMAIN_NAME || ''}</td>
      <td>${d.DOMAIN_DESCRIPTION || ''}</td>
      <td>${d.DISPLAY_ORDER || 0}</td>
      <td><button class="table-action view-domain" data-domain-id="${d.DOMAIN_ID}">View</button></td>
    `;
    tbody.appendChild(row);
  });
}

async function loadVersion() {
  const data = await apiFetch(apiPath(`/template-versions?templateId=${encodeURIComponent(currentTemplateId)}`));
  const versions = data.versions || [];
  currentVersion = versions.find(v => String(v.VERSION_ID) === String(currentVersionId));
  if (currentVersion) showVersion(currentVersion);
}

async function loadDomains() {
  const data = await apiFetch(apiPath(`/domains?versionId=${encodeURIComponent(currentVersionId)}`));
  renderDomains(data.domains || []);
}

async function loadPage() {
  const params = getParams();
  currentVersionId = params.versionId;
  currentTemplateId = params.templateId;

  await loadVersion();
  await loadDomains();
}

function openDomainModal() {
  document.getElementById('domainModal').classList.remove('hidden');
  document.getElementById('domainCode').focus();
}

function closeDomainModal() {
  document.getElementById('domainModal').classList.add('hidden');
  document.getElementById('domainFormMessage').textContent = '';
}

function clearDomainForm() {
  document.getElementById('domainCode').value = '';
  document.getElementById('domainName').value = '';
  document.getElementById('domainDescription').value = '';
  document.getElementById('domainOrder').value = '0';
}

async function saveDomain() {
  const message = document.getElementById('domainFormMessage');
  const code = document.getElementById('domainCode').value.trim();
  const name = document.getElementById('domainName').value.trim();
  const description = document.getElementById('domainDescription').value.trim();
  const displayOrder = document.getElementById('domainOrder').value;

  message.textContent = '';

  if (!code || !name) {
    message.textContent = 'Code and name are required.';
    return;
  }

  try {
    await apiFetch(apiPath('/domains'), {
      method: 'POST',
      body: JSON.stringify({
        versionId: currentVersionId,
        code,
        name,
        description,
        displayOrder
      })
    });

    clearDomainForm();
    closeDomainModal();
    await loadDomains();
  } catch (error) {
    message.textContent = error.data?.error || 'Unable to save the domain.';
  }
}

function setupDomainRowActions() {
  document.getElementById('domainsTable').addEventListener('click', (event) => {
    const button = event.target.closest('.view-domain');
    if (!button) return;
    window.location.href = `domain-detail.html?id=${encodeURIComponent(button.dataset.domainId)}&versionId=${encodeURIComponent(currentVersionId)}&templateId=${encodeURIComponent(currentTemplateId)}`;
  });
}

function setupVersionDetailPage() {
  document.getElementById('backToTemplate').addEventListener('click', () => {
    window.location.href = `template-detail.html?id=${encodeURIComponent(currentTemplateId)}`;
  });
  document.getElementById('btnNewDomain').addEventListener('click', openDomainModal);
  document.getElementById('closeDomainModal').addEventListener('click', closeDomainModal);
  document.getElementById('cancelDomain').addEventListener('click', closeDomainModal);
  document.getElementById('saveDomain').addEventListener('click', saveDomain);
  setupDomainRowActions();

  loadPage();
}

setupVersionDetailPage();
