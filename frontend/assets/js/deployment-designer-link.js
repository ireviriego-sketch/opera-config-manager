(() => {
  function enhanceDeploymentRows() {
    const container = document.getElementById('deploymentsContainer');
    if (!container) return;

    container.querySelectorAll('tbody tr').forEach(row => {
      if (row.dataset.designerLinkReady === 'Y') return;
      const firstCell = row.querySelector('td');
      const actionsCell = row.querySelector('.row-actions') || row.querySelector('td:last-child');
      if (!firstCell || !actionsCell) return;
      const deploymentId = firstCell.textContent.trim();
      if (!deploymentId) return;
      const link = document.createElement('a');
      link.className = 'secondary small button-link';
      link.href = `deployment-designer.html?id=${encodeURIComponent(deploymentId)}`;
      link.textContent = 'Open Designer';
      actionsCell.prepend(link);
      row.dataset.designerLinkReady = 'Y';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    enhanceDeploymentRows();
    const container = document.getElementById('deploymentsContainer');
    if (!container) return;
    const observer = new MutationObserver(enhanceDeploymentRows);
    observer.observe(container, { childList: true, subtree: true });
  });
})();
