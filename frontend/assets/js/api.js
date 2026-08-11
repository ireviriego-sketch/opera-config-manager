const API_BASE = '';

function getToken() {
  return localStorage.getItem('operaCfgToken');
}

function setToken(token) {
  localStorage.setItem('operaCfgToken', token);
}

function clearToken() {
  localStorage.removeItem('operaCfgToken');
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || data.error || 'API error');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}
