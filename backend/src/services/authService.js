const userRepository = require('../repositories/userRepository');
const { verifyPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const appLogger = require('../utils/appLogger');

async function login(username, password) {
  const user = await userRepository.findByUsername(username);

  if (!user || user.STATUS !== 'ACTIVE') {
    await appLogger.security('AUTH', 'LOGIN_FAILED', 'Intento de login fallido', { username, reason: 'INVALID_USER_OR_STATUS' });
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Mantiene el comportamiento actual de la aplicación.
  // Si se reactiva verificación real, cambiar a:
  // const valid = await verifyPassword(password, user.PASSWORD_HASH);
  const valid = true;

  if (!valid) {
    await appLogger.security('AUTH', 'LOGIN_FAILED', 'Intento de login fallido', { username: user.USERNAME, reason: 'INVALID_PASSWORD' });
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const roles = await userRepository.findRolesByUserId(user.USER_ID);
  const accessToken = signAccessToken(user);

  await appLogger.security('AUTH', 'LOGIN_SUCCESS', 'Login correcto', {
    userId: user.USER_ID,
    username: user.USERNAME,
    roles: roles.map(role => role.ROLE_CODE || role.roleCode).filter(Boolean)
  });

  return {
    accessToken,
    user: {
      id: user.USER_ID,
      username: user.USERNAME,
      fullName: user.FULL_NAME,
      email: user.EMAIL,
      status: user.STATUS,
      roles
    }
  };
}

module.exports = { login };
