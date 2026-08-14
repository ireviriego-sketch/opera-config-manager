const repository = require('../repositories/adminSecurity.repository');

const currentUser = (req) => req.user?.username || req.user?.USERNAME || 'system';

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

module.exports = {
  listUsers,
  getUser,
  listRoles,
  listChains,
  listHotels,
  updateUserRoles,
  replaceChainPermissions,
  replaceHotelPermissions
};
