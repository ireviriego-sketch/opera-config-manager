(() => {
  const api = window.ChainsApi;
  const state = { chains: [] };

  const $ = id => document.getElementById(id);
  const show = element => element.classList.remove('hidden');
  const hide = element => element.classList.add('hidden');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const badge = status => `<span class="badge ${status}">${status}</span>`;
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; show($('messageModal')); };
  const error = err => message('Validación', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    $('refreshBtn').onclick = loadChains;
    $('newChainBtn').onclick = openNewChain;
    $('closeModalBtn').onclick = () => hide($('chainModal'));
    $('closeMessageBtn').onclick = () => hide($('messageModal'));
    $('searchInput').oninput = renderChains;
    $('chainForm').onsubmit = saveChain;
    await loadChains();
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
    const query = $('searchInput').value.toLowerCase();
    const rows = state.chains.filter(chain => `${chain.chainCode} ${chain.chainName}`.toLowerCase().includes(query));

    $('chainsContainer').innerHTML = rows.length
      ? rows.map(chain => `
          <article class="chain-card">
            <h3>${escapeHtml(chain.chainName)}</h3>
            <p class="muted">${escapeHtml(chain.chainCode)} · ${badge(chain.status)}</p>
            <p class="muted">Hoteles: ${Number(chain.hotelsCount || 0)}</p>
            <div class="chain-card-footer">
              <a class="btn secondary small" href="chain-detail.html?id=${encodeURIComponent(chain.chainId)}">Abrir</a>
            </div>
          </article>
        `).join('')
      : '<p class="muted">No hay cadenas.</p>';
  }

  function openNewChain() {
    $('chainCodeInput').value = '';
    $('chainNameInput').value = '';
    $('chainStatusInput').value = 'ACTIVE';
    show($('chainModal'));
  }

  async function saveChain(event) {
    event.preventDefault();

    try {
      const payload = {
        chainCode: $('chainCodeInput').value.trim(),
        chainName: $('chainNameInput').value.trim(),
        status: $('chainStatusInput').value
      };

      const result = await api.createChain(payload);
      const chainId = result.chain?.chainId;

      if (chainId) {
        window.location.href = `chain-detail.html?id=${encodeURIComponent(chainId)}`;
        return;
      }

      hide($('chainModal'));
      await loadChains();
    } catch (err) {
      error(err);
    }
  }
})();
