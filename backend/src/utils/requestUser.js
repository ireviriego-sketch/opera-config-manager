function currentUser(req, options = {}) {
  const fallback = Object.prototype.hasOwnProperty.call(options, 'fallback') ? options.fallback : 'system';
  const includeEmail = options.includeEmail !== false;
  const includeName = options.includeName !== false;
  const headerUser = req?.headers?.['x-user'] || req?.headers?.['x-username'];

  return req?.user?.username
    || req?.user?.USERNAME
    || (includeEmail ? req?.user?.email : null)
    || (includeName ? req?.user?.name : null)
    || headerUser
    || fallback;
}

function currentUserId(req) {
  const userId = req?.authzUserId
    || req?.user?.userId
    || req?.user?.USER_ID
    || req?.user?.id
    || req?.user?.sub
    || null;

  return userId && /^\d+$/.test(String(userId)) ? Number(userId) : userId;
}

module.exports = {
  currentUser,
  currentUserId
};
