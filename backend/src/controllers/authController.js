const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'USERNAME_AND_PASSWORD_REQUIRED' });
    }
    const result = await authService.login(username, password);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, me };
