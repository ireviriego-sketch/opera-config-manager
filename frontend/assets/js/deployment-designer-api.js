window.DeploymentDesignerApi = (() => {
  const base = '/api/opera-config/deployment-content';
  const deploymentsBase = '/api/opera-config/deployments';

  async function http(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  return {
    getDeployment: deploymentId => http(`${deploymentsBase}/${deploymentId}`),
    getStructure: deploymentId => http(`${base}/${deploymentId}/structure`),
    getAttributes: (deploymentId, entityId) => http(`${base}/${deploymentId}/entities/${entityId}/attributes`),
    listRecords: (deploymentId, entityId) => http(`${base}/${deploymentId}/entities/${entityId}/records`),
    createRecord: (deploymentId, entityId, record) => http(`${base}/${deploymentId}/entities/${entityId}/records`, { method: 'POST', body: JSON.stringify({ record }) }),
    updateRecord: (deploymentId, recordId, record) => http(`${base}/${deploymentId}/records/${recordId}`, { method: 'PUT', body: JSON.stringify({ record }) }),
    deleteRecord: (deploymentId, recordId) => http(`${base}/${deploymentId}/records/${recordId}`, { method: 'DELETE' }),
    exportContent: deploymentId => http(`${deploymentsBase}/${deploymentId}/export-json`)
  };
})();
