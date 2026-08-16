(() => {
  const api = window.ChainsApi;
  const state = { chains: [] };
  const $ = id => document.getElementById(id);
  const show = element => element && element.classList.remove('hidden');
  const hide = element => element && element.classList.add('hidden');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const badge = status => `<span class="badge">${escapeHtml(status || '')}</span>`;

  const message = (title, html) => {
    if (!$('messageTitle') || !$('messageBody') || !$('messageModal')) return alert(title + '\n' + String(html || '').replace(/<[^>]*>/g, ''));
    $('messageTitle').textContent = title;
    $('messageBody').innerHTML = html;
    show($('messageModal'));
  };

  const error = err => message('Validación', `<p>${escapeHtml(err.message || err)}</p>`);

  async function loadChainLovs(){if(!window.LovsClient)return;await window.LovsClient.populateSelect('#chainStatusInput','STATUS',{defaultValue:'ACTIVE'});}
document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if ($('refreshBtn')) $('refreshBtn').onclick = loadChains;
    if ($('newChainBtn')) {
      $('newChainBtn').onclick = openNewChain;
      $('newChainBtn').disabled = true;
      $('newChainBtn').title = 'La creación de cadenas no está permitida desde este rol.';
    }
    if ($('closeModalBtn')) $('closeModalBtn').onclick = () => hide($('chainModal'));
    if ($('closeMessageBtn')) $('closeMessageBtn').onclick = () => hide($('messageModal'));
    if ($('searchInput')) $('searchInput').oninput = renderChains;
    if ($('chainForm')) $('chainForm').onsubmit = saveChain;
    await loadChainLovs(); await loadChains();
  }

  async function loadChains() {
    try {
      state.chains = (await api.listChains()).rows || [];
      renderChains();
    } catch (err) {
      error(err);
    }
  }

  function renderChains() {
    const query = ($('searchInput')?.value || '').toLowerCase();
    const rows = state.chains.filter(chain => `${chain.chainCode} ${chain.chainName}`.toLowerCase().includes(query));

    if (!$('chainsContainer')) return;

    if (!rows.length) {
      $('chainsContainer').innerHTML = `
        <div class="empty-state">
          <strong>No tiene cadenas asignadas.</strong>
          <p>Solicita a un administrador que asigne una o varias cadenas a tu usuario desde Administración &gt; Usuarios &gt; Cadenas autorizadas.</p>
        </div>
      `;
      return;
    }

    $('chainsContainer').innerHTML = rows.map(chain => `
      <article class="chain-card">
        <h3>${escapeHtml(chain.chainName)}</h3>
        <p>${escapeHtml(chain.chainCode)} · ${badge(chain.status)}</p>
        <p>Hoteles: ${Number(chain.hotelsCount || 0)}</p>
        <a class="btn btn-secondary" href="chain-detail.html?id=${encodeURIComponent(chain.chainId)}">Abrir</a>
      </article>
    `).join('');
  }

  function openNewChain() {
    message('Acceso restringido', '<p>La creación de nuevas cadenas no está permitida desde este rol. Primero debe existir una asignación explícita de cadena.</p>');
  }

  async function saveChain(event) {
    event.preventDefault();
    message('Acceso restringido', '<p>La creación de nuevas cadenas no está permitida desde este rol.</p>');
  }
})();
