async function loadTemplates() {

  const response = await fetch('/api/templates');
  const data = await response.json();

  const tbody = document.querySelector('#templatesTable tbody');

  tbody.innerHTML = '';

const templates = Array.isArray(data.templates)
  ? data.templates
  : [data.templates];

templates.forEach(t => {
     tbody.innerHTML += `
    <tr>
        <td>${t.TEMPLATE_ID}</td>
        <td>${t.TEMPLATE_CODE}</td>
        <td>${t.TEMPLATE_NAME}</td>
        <td>${t.STATUS}</td>
    </tr>
    `;
  });

}


document.getElementById('saveTemplate')
  .addEventListener('click', async () => {

    const code =
      document.getElementById('code').value;

    const name =
      document.getElementById('name').value;

    const description =
      document.getElementById('description').value;

    const response = await fetch(
      '/api/templates',
      {
        method: 'POST',
        headers: {
          'Content-Type':'application/json'
        },
        body: JSON.stringify({
          code,
          name,
          description
        })
      }
    );

console.log('STATUS', response.status);
console.log('OK', response.ok);

if(response.ok){
   await loadTemplates();
}
  });