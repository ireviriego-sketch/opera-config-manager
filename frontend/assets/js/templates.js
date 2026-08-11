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

loadTemplates();