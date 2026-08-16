(function () {
  'use strict';

  const DEFAULT_FOOTER = {
    enabled: true,
    copyrightText: 'Accenture. All rights reserved. Accenture Highly Confidential. For internal use only.',
    links: [
      { text: 'Cookie Policy', url: 'https://www.accenture.com/us-en/company-cookies-similar-technology' },
      { text: 'Terms of Use', url: 'https://www.accenture.com/us-en/support/terms-of-use' }
    ]
  };

  const esc = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  async function requestJson(url) {
    const token = localStorage.getItem('operaCfgToken') || localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || '';
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
    if (!response.ok) throw new Error(payload?.message || payload?.error || text || `HTTP ${response.status}`);
    return payload;
  }

  async function loadFooterConfig() {
    try {
      const payload = await requestJson('/api/app-settings/footer');
      return payload.footer || DEFAULT_FOOTER;
    } catch (error) {
      console.warn('Using default footer configuration', error);
      return DEFAULT_FOOTER;
    }
  }

  function renderFooter(config) {
    if (!config || config.enabled === false) return;
    let footer = document.getElementById('appFooter');
    if (!footer) {
      footer = document.createElement('footer');
      footer.id = 'appFooter';
      footer.className = 'app-footer';
      document.body.appendChild(footer);
    }

    const year = new Date().getFullYear();
    const links = Array.isArray(config.links) ? config.links.filter(link => link && link.text && link.url) : [];
    footer.innerHTML = `
      <nav class="app-footer-links" aria-label="Footer links">
        ${links.map(link => `<a class="app-footer-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.text)}</a>`).join('')}
      </nav>
      <div class="app-footer-copy">© ${year} ${esc(config.copyrightText || '')}</div>
      <div class="app-footer-spacer" aria-hidden="true"></div>
    `;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const config = await loadFooterConfig();
    renderFooter(config);
  });
})();
