window.LovsClient = (() => {
  const cache = new Map();

  const requestJson = window.AppUtils?.requestJson || (async function requestJson(url, options = {}) {
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

  async function getValues(lovCode, options = {}) {
    const includeInactive = options.includeInactive === true ? 'true' : 'false';
    const parentValueCode = options.parentValueCode ? `&parentValueCode=${encodeURIComponent(options.parentValueCode)}` : '';
    const parentLovValueId = options.parentLovValueId ? `&parentLovValueId=${encodeURIComponent(options.parentLovValueId)}` : '';
    const key = `${lovCode}|${includeInactive}|${parentValueCode}|${parentLovValueId}`;
    if (cache.has(key)) return cache.get(key);
    const payload = await requestJson(`/api/lovs/code/${encodeURIComponent(lovCode)}/values?includeInactive=${includeInactive}${parentValueCode}${parentLovValueId}`);
    const items = payload.items || [];
    cache.set(key, items);
    return items;
  }

  function normalizeSelect(selectOrSelector) {
    if (!selectOrSelector) return null;
    if (typeof selectOrSelector === 'string') return document.querySelector(selectOrSelector);
    return selectOrSelector;
  }

  async function populateSelect(selectOrSelector, lovCode, options = {}) {
    const select = normalizeSelect(selectOrSelector);
    if (!select) return [];
    const currentValue = options.value !== undefined ? String(options.value || '') : String(select.value || '');
    const items = await getValues(lovCode, options);
    const emptyLabel = options.emptyLabel;
    select.innerHTML = '';
    if (emptyLabel !== undefined) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyLabel;
      select.appendChild(option);
    }
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.valueCode;
      option.textContent = item.valueLabel || item.valueCode;
      select.appendChild(option);
    });
    if (currentValue && Array.from(select.options).some(option => option.value === currentValue)) select.value = currentValue;
    else if (options.defaultValue && Array.from(select.options).some(option => option.value === options.defaultValue)) select.value = options.defaultValue;
    return items;
  }

  async function dataTypes() {
    const items = await getValues('DATA_TYPE');
    return items.map(item => ({
      DATA_TYPE_CODE: item.valueCode,
      DATA_TYPE_NAME: item.valueLabel || item.valueCode
    }));
  }

  return { getValues, populateSelect, dataTypes };
})();
