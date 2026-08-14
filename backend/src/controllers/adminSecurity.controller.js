const repository = require('../repositories/adminSecurity.repository');

function currentUser(req) {
  return req.user?.username || req.user?.USERNAME || req.headers['x-user'] || 'system';
}

function buildBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

async function listUsers(req, res, next) {
  try { res.json({ items: await repository.findUsers() }); } catch (error) { next(error); }
}

async function getUser(req, res, next) {
  try {
    const item = await repository.findUserById(Number(req.params.userId));
    if (!item) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({ item });
  } catch (error) { next(error); }
}

async function createUser(req, res, next) {
  try {
    const item = await repository.createUser({
      username: req.body.username,
      fullName: req.body.fullName,
      email: req.body.email,
      status: req.body.status || 'ACTIVE',
      roleIds: req.body.roleIds || [],
      createdBy: currentUser(req)
    });
    const token = await repository.createPasswordResetToken(item.userId, currentUser(req));
    const resetUrl = `${buildBaseUrl(req)}/set-password.html?token=${encodeURIComponent(token)}`;
    res.status(201).json({ item, resetUrl });
  } catch (error) { next(error); }
}

async function listRoles(req, res, next) {
  try { res.json({ items: await repository.findRoles() }); } catch (error) { next(error); }
}

async function listChains(req, res, next) {
  try { res.json({ items: await repository.findChains() }); } catch (error) { next(error); }
}

async function listHotels(req, res, next) {
  try { res.json({ items: await repository.findHotels() }); } catch (error) { next(error); }
}

async function updateUserRoles(req, res, next) {
  try {
    await repository.replaceUserRoles(Number(req.params.userId), req.body.roleIds || [], currentUser(req));
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function replaceChainPermissions(req, res, next) {
  try {
    await repository.replaceScopePermissions({
      userId: Number(req.params.userId),
      roleId: Number(req.body.roleId),
      scopeType: 'CHAIN',
      ids: req.body.chainIds || [],
      isReadOnly: req.body.isReadOnly || 'N',
      createdBy: currentUser(req)
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function replaceHotelPermissions(req, res, next) {
  try {
    await repository.replaceScopePermissions({
      userId: Number(req.params.userId),
      roleId: Number(req.body.roleId),
      scopeType: 'HOTEL',
      ids: req.body.hotelIds || [],
      isReadOnly: req.body.isReadOnly || 'N',
      createdBy: currentUser(req)
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function generatePasswordReset(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const item = await repository.findUserById(userId);
    if (!item) return res.status(404).json({ message: 'Usuario no encontrado' });
    const token = await repository.createPasswordResetToken(userId, currentUser(req));
    const resetUrl = `${buildBaseUrl(req)}/set-password.html?token=${encodeURIComponent(token)}`;
    res.json({ ok: true, resetUrl });
  } catch (error) { next(error); }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  listRoles,
  listChains,
  listHotels,
  updateUserRoles,
  replaceChainPermissions,
  replaceHotelPermissions,
  generatePasswordReset
};
