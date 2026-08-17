(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  let footerLinks = [];
  let copyrightText = 'Accenture. All rights reserved. Accenture Highly Confidential. For internal use only.';

  const esc = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

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

  function renderPreview() {
    const year = new Date().getFullYear();
    const linksHtml = footerLinks
      .filter(link => link.status !== 'INACTIVE' && link.text && link.url)
      .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
      .map(link => `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.text)}</a>`)
      .join('');

    $('footerPreview').innerHTML = `
      <div>${linksHtml}</div>
      <div class="footer-preview-copy">© ${year} ${esc(copyrightText || '')}</div>
      <div></div>
    `;
  }

  function renderLinkRows() {
    const container = $('footerLinksRows');
    if (!footerLinks.length) {
      container.innerHTML = '<p>No hay enlaces configurados.</p>';
      renderPreview();
      return;
    }

    container.innerHTML = footerLinks.map((link, index) => `
      <div class="footer-link-row" data-footer-link-index="${index}">
        <label>Texto
          <input class="form-control" data-footer-link-field="text" value="${esc(link.text || '')}">
        </label>
        <label>URL
          <input class="form-control" data-footer-link-field="url" value="${esc(link.url || '')}">
        </label>
        <label>Orden
          <input class="form-control" data-footer-link-field="displayOrder" type="number" value="${esc(link.displayOrder || ((index + 1) * 10))}">
        </label>
        <button type="button" class="btn btn-danger" data-remove-footer-link="${index}">Eliminar</button>
      </div>
    `).join('');
    renderPreview();
  }

  function collectRows() {
    document.querySelectorAll('[data-footer-link-index]').forEach(row => {
      const index = Number(row.dataset.footerLinkIndex);
      row.querySelectorAll('[data-footer-link-field]').forEach(input => {
        footerLinks[index][input.dataset.footerLinkField] = input.type === 'number' ? Number(input.value || 0) : input.value.trim();
      });
    });
  }

  async function loadFooter() {
    const payload = await requestJson('/api/app-settings/footer');
    const footer = payload.footer || {};
    copyrightText = footer.copyrightText || copyrightText;
    footerLinks = Array.isArray(footer.links) ? footer.links.map((link, index) => ({
      text: link.text || link.linkText || '',
      url: link.url || link.linkUrl || '',
      displayOrder: link.displayOrder || ((index + 1) * 10),
      status: link.status || 'ACTIVE'
    })) : [];
    renderLinkRows();
  }

  async function saveFooter() {
    collectRows();
    const payload = {
      enabled: true,
      copyrightText,
      links: footerLinks
    };
    await requestJson('/api/app-settings/footer', { method: 'PUT', body: JSON.stringify(payload) });
    $('footerMessage').textContent = 'Footer guardado correctamente.';
    renderPreview();
  }

  document.addEventListener('input', event => {
    if (event.target.matches('[data-footer-link-field]')) {
      collectRows();
      renderPreview();
    }
  });

  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-footer-link]');
    if (remove) {
      collectRows();
      footerLinks.splice(Number(remove.dataset.removeFooterLink), 1);
      renderLinkRows();
    }
  });

  $('addFooterLinkBtn')?.addEventListener('click', () => {
    collectRows();
    footerLinks.push({ text: 'New link', url: 'https://www.accenture.com', displayOrder: (footerLinks.length + 1) * 10, status: 'ACTIVE' });
    renderLinkRows();
  });

  $('saveFooterBtn')?.addEventListener('click', () => saveFooter().catch(error => {
    $('footerMessage').textContent = error.message || 'No se ha podido guardar el footer.';
  }));

  loadFooter().catch(error => {
    $('footerMessage').textContent = error.message || 'No se ha podido cargar la configuración del footer.';
  });
})();
