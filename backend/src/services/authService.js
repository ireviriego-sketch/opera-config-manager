const userRepository = require('../repositories/userRepository');
const { verifyPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');

async function login(username, password) {
  const user = await userRepository.findByUsername(username);
  if (!user || user.STATUS !== 'ACTIVE') {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }


const valid = await verifyPassword(password,user.PASSWORD_HASH.trim());


  if (!valid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const roles = await userRepository.findRolesByUserId(user.USER_ID);
  const accessToken = signAccessToken(user);

  return {
    accessToken,
    user: {
      id: user.USER_ID,
      username: user.USERNAME,
      fullName: user.FULL_NAME,
      email: user.EMAIL,
      roles
    }
  };
}

module.exports = { login };
