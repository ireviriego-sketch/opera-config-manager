window.DeploymentContentApi = (() => {
  const base = apiPath('/opera-config/deployment-content');

  async function http(path = '', options = {}) {
    const response = await fetch(`${base}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  return {
    getStructure: deploymentId => http(`/${deploymentId}/structure`),
    getAttributes: (deploymentId, entityId) => http(`/${deploymentId}/entities/${entityId}/attributes`),
    listRecords: (deploymentId, entityId) => http(`/${deploymentId}/entities/${entityId}/records`),
    createRecord: (deploymentId, entityId, record) => http(`/${deploymentId}/entities/${entityId}/records`, { method: 'POST', body: JSON.stringify({ record }) }),
    updateRecord: (deploymentId, recordId, record) => http(`/${deploymentId}/records/${recordId}`, { method: 'PUT', body: JSON.stringify({ record }) }),
    deleteRecord: (deploymentId, recordId) => http(`/${deploymentId}/records/${recordId}`, { method: 'DELETE' })
  };
})();
