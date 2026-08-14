const repository = require('../repositories/adminSecurity.repository');

async function validateToken(req, res, next) {
  try {
    const item = await repository.validatePasswordResetToken(req.params.token);
    if (!item) return res.status(404).json({ ok: false, message: 'El enlace no existe, ha caducado o ya fue usado.' });
    res.json({ ok: true, user: { username: item.username, email: item.email } });
  } catch (error) { next(error); }
}

async function confirmPassword(req, res, next) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || String(password).length < 8) {
      return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    const item = await repository.setPasswordWithToken(token, password);
    if (!item) return res.status(404).json({ ok: false, message: 'El enlace no existe, ha caducado o ya fue usado.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
}

module.exports = { validateToken, confirmPassword };
