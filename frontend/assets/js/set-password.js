(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const status = document.getElementById('tokenStatus');
  const form = document.getElementById('setPasswordForm');
  const message = document.getElementById('setPasswordMessage');
  const loginLink = document.getElementById('loginLink');

  const requestJson = window.AppUtils?.requestJson || (async function requestJson(url, options = {}) {
    const token = localStorage.getItem('operaCfgToken') || localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || '';
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
    if (!response.ok) throw new Error(payload?.message || payload?.error || text || `HTTP ${response.status}`);
    return payload;
  });

  async function validate() {
    if (!token) throw new Error('The link does not contain a token.');
    const result = await requestJson(`/api/password-reset/validate/${encodeURIComponent(token)}`);
    status.textContent = `Valid link for ${result.user?.username || 'user'}.`;
    form.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;

    if (password.length < 8) {
      message.textContent = 'Password must be at least 8 characters.';
      return;
    }
    if (password !== passwordConfirm) {
      message.textContent = 'Passwords do not match.';
      return;
    }

    try {
      await requestJson('/api/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      form.hidden = true;
      status.textContent = 'Password created successfully.';
      message.textContent = 'You can now sign in with your new password.';
      loginLink.hidden = false;
    } catch (error) {
      message.textContent = error.message;
    }
  });

  validate().catch((error) => {
    status.textContent = error.message;
    form.hidden = true;
  });
})();
