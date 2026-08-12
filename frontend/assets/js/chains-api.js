window.ChainsApi = (() => {
  const base = '/api/opera-config/chains';

  async function http(path = '', options = {}) {
    const response = await fetch(`${base}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.ok === false) {
      throw new Error(body.error || `HTTP ${response.status}`);
    }

    return body;
  }

  return {
    listChains: () => http(''),
    getChain: chainId => http(`/${chainId}`),
    createChain: payload => http('', { method: 'POST', body: JSON.stringify(payload) }),
    updateChain: (chainId, payload) => http(`/${chainId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    listHotels: chainId => http(`/${chainId}/hotels`),
    createHotel: (chainId, payload) => http(`/${chainId}/hotels`, { method: 'POST', body: JSON.stringify(payload) }),
    updateHotel: (chainId, hotelId, payload) => http(`/${chainId}/hotels/${hotelId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    importHotels: (chainId, payload = {}) => http(`/${chainId}/import-hotels-from-acc-hospitality`, { method: 'POST', body: JSON.stringify(payload) })
  };
})();
