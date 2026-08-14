const { execute } = require('../db/query');

function decodeJwtPayload(token) {
  try {
    const payloadPart = String(token || '').split('.')[1];
    if (!payloadPart) return {};
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch (error) {
    return {};
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
}

function getUserClaim(req) {
  const tokenPayload = decodeJwtPayload(getBearerToken(req));
  const user = req.user || req.auth || {};
  const headerUser = req.headers['x-user'] || req.headers['x-username'];

  return {
    userId: user.userId || user.USER_ID || user.id || tokenPayload.userId || tokenPayload.USER_ID || tokenPayload.id,
    username: user.username || user.USERNAME || user.name || user.email || tokenPayload.username || tokenPayload.USERNAME || tokenPayload.preferred_username || tokenPayload.email || headerUser
  };
}

async function findUserIdByUsername(username) {
  const result = await execute(
    `SELECT USER_ID AS "userId"
       FROM OPERA_CFG_USERS
      WHERE UPPER(USERNAME) = UPPER(:username)
         OR UPPER(EMAIL) = UPPER(:username)
      FETCH FIRST 1 ROWS ONLY`,
    { username }
  );
  const row = result.rows && result.rows[0];
  return row ? Number(row.userId || row.USER_ID) : null;
}

async function resolveUserId(req) {
  const claim = getUserClaim(req);

  if (claim.userId && /^\d+$/.test(String(claim.userId))) return Number(claim.userId);
  if (claim.username) {
    const userId = await findUserIdByUsername(claim.username);
    if (userId) return userId;
  }

  // Development-friendly fallback for the local accelerator.
  // This prevents role protection from breaking pages when the frontend is not yet sending a token.
  // In production, set NODE_ENV=production to disable this fallback.
  if (process.env.NODE_ENV !== 'production') {
    const fallbackUsername = process.env.OPERA_CFG_DEV_USER || 'admin';
    const fallbackUserId = await findUserIdByUsername(fallbackUsername);
    if (fallbackUserId) return fallbackUserId;
  }

  return null;
}

async function getRequestRoles(req) {
  if (Array.isArray(req.authzRoles)) return req.authzRoles;

  const userId = await resolveUserId(req);
  req.authzUserId = userId;

  if (!userId) {
    req.authzRoles = [];
    return req.authzRoles;
  }

  const result = await execute(
    `SELECT r.ROLE_CODE AS "roleCode"
       FROM OPERA_CFG_USER_ROLES ur
       JOIN OPERA_CFG_ROLES r ON r.ROLE_ID = ur.ROLE_ID
      WHERE ur.USER_ID = :userId`,
    { userId }
  );

  req.authzRoles = (result.rows || []).map((row) => row.roleCode || row.ROLE_CODE);
  return req.authzRoles;
}

function requireAnyRole(requiredRoles) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return async function roleMiddleware(req, res, next) {
    try {
      const userRoles = await getRequestRoles(req);

      if (!req.authzUserId) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'No se pudo identificar el usuario autenticado.' });
      }

      const allowed = roles.some((role) => userRoles.includes(role));
      if (!allowed) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'El usuario no tiene el rol requerido.', requiredRoles: roles });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireRole(roleCode) {
  return requireAnyRole([roleCode]);
}

async function attachRoles(req, _res, next) {
  try {
    await getRequestRoles(req);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { attachRoles, getRequestRoles, requireAnyRole, requireRole };
