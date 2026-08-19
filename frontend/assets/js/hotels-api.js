window.HotelsApi = (() => {
  const base = apiPath('/opera-config/hotels');

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
    listHotels: search => {
      const q = String(search || '').trim();
      return http(q ? `?search=${encodeURIComponent(q)}` : '');
    }
  };
})();
