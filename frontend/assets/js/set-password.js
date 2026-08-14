(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const status = document.getElementById('tokenStatus');
  const form = document.getElementById('setPasswordForm');
  const message = document.getElementById('setPasswordMessage');
  const loginLink = document.getElementById('loginLink');

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    return payload;
  }

  async function validate() {
    if (!token) throw new Error('El enlace no contiene token.');
    const result = await requestJson(`/api/password-reset/validate/${encodeURIComponent(token)}`);
    status.textContent = `Enlace válido para ${result.user?.username || 'usuario'}.`;
    form.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;

    if (password.length < 8) {
      message.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }
    if (password !== passwordConfirm) {
      message.textContent = 'Las contraseñas no coinciden.';
      return;
    }

    try {
      await requestJson('/api/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      form.hidden = true;
      status.textContent = 'Contraseña creada correctamente.';
      message.textContent = 'Ya puedes iniciar sesión con tu nueva contraseña.';
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
