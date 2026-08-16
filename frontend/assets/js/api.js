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

/* ==========================================================================
   JS Refactor Step 1 - Shared Utilities
   Low-risk global helpers. Existing functions remain untouched.
   ========================================================================== */
window.AppUtils = window.AppUtils || (() => {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function show(element) {
    if (element) element.classList.remove('hidden');
  }

  function hide(element) {
    if (element) element.classList.add('hidden');
  }

  function downloadJson(content, filename = 'export.json') {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return { escapeHtml, qs, byId, show, hide, downloadJson };
})();


/* Shared JSON request helper. Kept separate from apiFetch because several legacy modules
   accept token names beyond operaCfgToken and expect a text-first JSON parse path. */
window.AppUtils.requestJson = window.AppUtils.requestJson || (async function requestJson(url, options = {}) {
  const token = localStorage.getItem('operaCfgToken') || localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || '';
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!response.ok) throw new Error(payload?.message || payload?.error || text || `HTTP ${response.status}`);
  return payload;
});
