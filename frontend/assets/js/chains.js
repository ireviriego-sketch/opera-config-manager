(() => {
  const api = window.ChainsApi;
  const state = { chains: [] };
  const $ = id => document.getElementById(id);
  const show = element => element && element.classList.remove('hidden');
  const hide = element => element && element.classList.add('hidden');
  const escapeHtml = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])));
  const badge = status => `<span class="badge">${escapeHtml(status || '')}</span>`;

  const message = (title, html) => {
    if (!$('messageTitle') || !$('messageBody') || !$('messageModal')) return alert(title + '\n' + String(html || '').replace(/<[^>]*>/g, ''));
    $('messageTitle').textContent = title;
    $('messageBody').innerHTML = html;
    show($('messageModal'));
  };

  const error = err => message('Validation', `<p>${escapeHtml(err.message || err)}</p>`);

  async function loadChainLovs(){if(!window.LovsClient)return;await window.LovsClient.populateSelect('#chainStatusInput','STATUS',{defaultValue:'ACTIVE'});}
document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if ($('refreshBtn')) $('refreshBtn').onclick = loadChains;
    if ($('newChainBtn')) {
      $('newChainBtn').onclick = openNewChain;
      $('newChainBtn').disabled = true;
      $('newChainBtn').title = 'Creating chains is not allowed from this role.';
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
          <strong>No chains assigned.</strong>
          <p>Solicita a un administrador que asigne una o varias chains a tu user desde Administration &gt; Users &gt; Authorized Chains.</p>
        </div>
      `;
      return;
    }

    $('chainsContainer').innerHTML = rows.map(chain => `
      <article class="chain-card">
        <h3>${escapeHtml(chain.chainName)}</h3>
        <p>${escapeHtml(chain.chainCode)} · ${badge(chain.status)}</p>
        <p>Hotels: ${Number(chain.hotelsCount || 0)}</p>
        <a class="btn btn-secondary" href="chain-detail.html?id=${encodeURIComponent(chain.chainId)}">Open</a>
      </article>
    `).join('');
  }

  function openNewChain() {
    message('Restricted Access', '<p>Creating new chains is not allowed from this role. An explicit chain assignment must exist first.</p>');
  }

  async function saveChain(event) {
    event.preventDefault();
    message('Restricted Access', '<p>Creating new chains is not allowed from this role.</p>');
  }
})();
