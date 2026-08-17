(() => {
  const api = window.HotelsApi;
  const state = { hotels: [], search: '' };
  const $ = id => document.getElementById(id);

  const escapeHtml = window.AppUtils?.escapeHtml || (value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])));
  const show = element => element.classList.remove('hidden');
  const hide = element => element.classList.add('hidden');
  const badge = status => `<span class="badge ${status}">${status}</span>`;
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; show($('messageModal')); };
  const error = err => message('Error', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  let debounceTimer = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    $('refreshBtn').onclick = loadHotels;
    $('clearSearchBtn').onclick = clearSearch;
    $('closeMessageBtn').onclick = () => hide($('messageModal'));
    $('hotelSearchInput').oninput = () => {
      state.search = $('hotelSearchInput').value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadHotels, 250);
    };
    await loadHotels();
  }

  async function loadHotels() {
    try {
      const data = await api.listHotels(state.search);
      state.hotels = data.rows || [];
      renderHotels();
    } catch (err) {
      error(err);
    }
  }

  function clearSearch() {
    state.search = '';
    $('hotelSearchInput').value = '';
    loadHotels();
  }

  function renderHotels() {
    $('hotelsSummary').textContent = `${state.hotels.length} hotels found`;

    if (!state.hotels.length) {
      $('hotelsContainer').innerHTML = '<p class="muted">No hotels match the filter.</p>';
      return;
    }

    $('hotelsContainer').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>HOTEL_ID</th>
            <th>HOTEL_CODE</th>
            <th>HOTEL_NAME</th>
            <th>CHAIN_CODE</th>
            <th>CHAIN_NAME</th>
            <th>STATUS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.hotels.map(hotel => `
            <tr>
              <td>${hotel.hotelId}</td>
              <td>${escapeHtml(hotel.hotelCode)}</td>
              <td>${escapeHtml(hotel.hotelName)}</td>
              <td>${escapeHtml(hotel.chainCode)}</td>
              <td>${escapeHtml(hotel.chainName)}</td>
              <td>${badge(hotel.status)}</td>
              <td><a class="secondary small button-link" href="chain-detail.html?id=${encodeURIComponent(hotel.chainId)}">Open Chain</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
})();
