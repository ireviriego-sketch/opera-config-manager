window.DeploymentsApi = (() => {
  const base = '/api/opera-config/deployments';

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
    listByChain: chainId => http(`?chainId=${encodeURIComponent(chainId)}`),
    listTemplateVersions: () => http('/sources/template-versions'),
    createForChain: (chainId, payload) => http(`/chains/${chainId}`, { method: 'POST', body: JSON.stringify(payload) }),
    update: (deploymentId, payload) => http(`/${deploymentId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    copy: deploymentId => http(`/${deploymentId}/copy`, { method: 'POST', body: JSON.stringify({}) }),
    getContent: deploymentId => http(`/${deploymentId}/content`),
    exportJson: deploymentId => http(`/${deploymentId}/export-json`)
  };
})();
