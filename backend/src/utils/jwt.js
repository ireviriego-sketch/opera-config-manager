const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.USER_ID),
      username: user.USERNAME,
      fullName: user.FULL_NAME || null
    },
    env.jwtSecret,
    { expiresIn: `${env.jwtAccessTokenMinutes}m` }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { signAccessToken, verifyAccessToken };
