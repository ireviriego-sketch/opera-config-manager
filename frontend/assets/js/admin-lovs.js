(function () {
  const body = document.getElementById('lovsBody');
  const search = document.getElementById('lovSearch');
  let lovs = [];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function render(rows) {
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5">No hay LOVs.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(l => `
      <tr>
        <td>${esc(l.lovCode)}</td>
        <td>${esc(l.lovName)}</td>
        <td>${esc(l.valueCount)}</td>
        <td>${esc(l.status)}</td>
        <td>${esc(l.updatedAt)}</td>
      </tr>
    `).join('');
  }

  function filter() {
    const q = search.value.trim().toLowerCase();
    if (!q) return render(lovs);
    render(lovs.filter(l => JSON.stringify(l).toLowerCase().includes(q)));
  }

  async function init() {
    try {
      const response = await fetch('/api/admin/lovs');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      lovs = await response.json();
      render(lovs);
    } catch (error) {
      console.error(error);
      body.innerHTML = '<tr><td colspan="5">No se han podido cargar las LOVs.</td></tr>';
    }
  }

  search.addEventListener('input', filter);
  document.getElementById('newLovBtn').addEventListener('click', () => alert('Pendiente: formulario de LOV.'));
  init();
})();
