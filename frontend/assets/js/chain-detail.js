(() => {
  const api = window.ChainsApi;
  const state = { chainId: null, chain: null, hotels: [] };

  const $ = id => document.getElementById(id);
  const show = element => element.classList.remove('hidden');
  const hide = element => element.classList.add('hidden');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const badge = status => `<span class="badge ${status}">${status}</span>`;
  const message = (title, html) => { $('messageTitle').textContent = title; $('messageBody').innerHTML = html; show($('messageModal')); };
  const error = err => message('Validación', `<ul class="error-list"><li>${escapeHtml(err.message || err)}</li></ul>`);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    state.chainId = new URLSearchParams(window.location.search).get('id');
    if (!state.chainId) {
      error('Falta el parámetro id en la URL.');
      return;
    }

    $('saveChainBtn').onclick = saveChain;
    $('newHotelBtn').onclick = newHotel;
    $('cancelHotelBtn').onclick = () => hide($('hotelForm'));
    $('hotelForm').onsubmit = saveHotel;
    $('importHotelsBtn').onclick = importHotels;
    $('closeMessageBtn').onclick = () => hide($('messageModal'));
    document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => switchTab(tab.dataset.tab));

    await loadAll();
  }

  async function loadAll() {
    try {
      state.chain = (await api.getChain(state.chainId)).chain;
      state.hotels = (await api.listHotels(state.chainId)).rows || [];
      renderChain();
      renderHotels();
    } catch (err) {
      error(err);
    }
  }

  function renderChain() {
    const chain = state.chain;
    $('pageTitle').textContent = chain.chainName;
    $('pageSubtitle').innerHTML = `${escapeHtml(chain.chainCode)} · ${badge(chain.status)}`;
    $('chainIdInput').value = chain.chainId;
    $('chainCodeInput').value = chain.chainCode;
    $('chainNameInput').value = chain.chainName;
    $('chainStatusInput').value = chain.status;
  }

  async function saveChain() {
    try {
      const payload = {
        chainCode: $('chainCodeInput').value.trim(),
        chainName: $('chainNameInput').value.trim(),
        status: $('chainStatusInput').value
      };

      state.chain = (await api.updateChain(state.chainId, payload)).chain;
      renderChain();
      message('Guardado', '<p>Cadena guardada correctamente.</p>');
    } catch (err) {
      error(err);
    }
  }

  function switchTab(id) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === id));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== id));
  }

  function renderHotels() {
    $('hotelsContainer').innerHTML = state.hotels.length
      ? `<table>
          <thead><tr><th>HOTEL_ID</th><th>HOTEL_CODE</th><th>HOTEL_NAME</th><th>STATUS</th><th></th></tr></thead>
          <tbody>${state.hotels.map(hotel => `
            <tr>
              <td>${hotel.hotelId}</td>
              <td>${escapeHtml(hotel.hotelCode)}</td>
              <td>${escapeHtml(hotel.hotelName)}</td>
              <td>${badge(hotel.status)}</td>
              <td><button class="btn secondary small" data-edit-hotel="${hotel.hotelId}">Editar</button></td>
            </tr>`).join('')}
          </tbody>
        </table>`
      : '<p class="muted">No hay hoteles para esta cadena.</p>';

    document.querySelectorAll('[data-edit-hotel]').forEach(button => button.onclick = () => editHotel(Number(button.dataset.editHotel)));
  }

  function newHotel() {
    $('hotelIdInput').value = '';
    $('hotelCodeInput').value = '';
    $('hotelNameInput').value = '';
    $('hotelStatusInput').value = 'ACTIVE';
    show($('hotelForm'));
  }

  function editHotel(hotelId) {
    const hotel = state.hotels.find(item => item.hotelId === hotelId);
    if (!hotel) return;

    $('hotelIdInput').value = hotel.hotelId;
    $('hotelCodeInput').value = hotel.hotelCode;
    $('hotelNameInput').value = hotel.hotelName;
    $('hotelStatusInput').value = hotel.status;
    show($('hotelForm'));
  }

  async function saveHotel(event) {
    event.preventDefault();

    try {
      const payload = {
        hotelCode: $('hotelCodeInput').value.trim(),
        hotelName: $('hotelNameInput').value.trim(),
        status: $('hotelStatusInput').value
      };

      const hotelId = $('hotelIdInput').value;
      if (hotelId) await api.updateHotel(state.chainId, hotelId, payload);
      else await api.createHotel(state.chainId, payload);

      hide($('hotelForm'));
      state.hotels = (await api.listHotels(state.chainId)).rows || [];
      renderHotels();
    } catch (err) {
      error(err);
    }
  }

  async function importHotels() {
    try {
      const value = prompt('ID de cadena en Accenture Hospitality. Déjalo vacío para buscar por nombre:');
      const payload = value && value.trim() ? { accChainId: Number(value.trim()) } : {};
      const result = await api.importHotels(state.chainId, payload);

      state.hotels = result.hotels || (await api.listHotels(state.chainId)).rows || [];
      renderHotels();
      switchTab('hotelsPanel');

      message('Importación completada', `
        <p>Origen: ${escapeHtml(result.sourceChainId || 'buscado por nombre')}</p>
        <p>Insertados: ${Number(result.imported || 0)}</p>
        <p>Actualizados: ${Number(result.updated || 0)}</p>
        <p>Omitidos: ${Number(result.skipped || 0)}</p>
      `);
    } catch (err) {
      error(err);
    }
  }
})();
