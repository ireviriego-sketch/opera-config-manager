document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.getElementById('loginMessage');
  message.textContent = '';

  try {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const result = await apiFetch(apiPath('/auth/login'), {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(result.accessToken);
    window.location.href = 'index.html';
  } catch (error) {
    message.textContent = 'Unable to sign in. Check user and password.';
  }
});
