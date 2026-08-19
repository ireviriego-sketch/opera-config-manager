const API_BASE = '';
const API_PREFIX = '/accenture_hospitality/api';

function apiPath(path = '') {
  return `${API_PREFIX}${path}`;
}

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

/* ==========================================================================
   JS Refactor Step 4 - Shared Message Utilities
   Shared lightweight UI messages. This does not replace module-specific modals yet.
   ========================================================================== */
window.AppUtils = window.AppUtils || {};

window.AppUtils.showInfo = window.AppUtils.showInfo || function showInfo(message, options = {}) {
  const text = String(message ?? '');
  if (window.showToast && typeof window.showToast === 'function') {
    window.showToast(text, { type: 'info', ...options });
    return;
  }
  if (options.silent !== true) console.info(text);
};

window.AppUtils.showSuccess = window.AppUtils.showSuccess || function showSuccess(message, options = {}) {
  const text = String(message ?? '');
  if (window.showToast && typeof window.showToast === 'function') {
    window.showToast(text, { type: 'success', ...options });
    return;
  }
  if (options.silent !== true) console.info(text);
};

window.AppUtils.showError = window.AppUtils.showError || function showError(error, fallbackMessage = 'An error occurred') {
  const message = error?.message || error?.data?.message || error?.data?.error || error || fallbackMessage;
  const text = String(message ?? fallbackMessage);
  if (window.showToast && typeof window.showToast === 'function') {
    window.showToast(text, { type: 'error' });
    return;
  }
  console.error(text, error);
  if (window.alert && fallbackMessage !== false) window.alert(text);
};

window.AppUtils.showMessage = window.AppUtils.showMessage || function showMessage(message, options = {}) {
  const type = options.type || 'info';
  if (type === 'error') return window.AppUtils.showError(message, options.fallbackMessage || 'An error occurred');
  if (type === 'success') return window.AppUtils.showSuccess(message, options);
  return window.AppUtils.showInfo(message, options);
};