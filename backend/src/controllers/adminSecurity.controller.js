const repository = require('../repositories/adminSecurity.repository');
const { auditSafely } = require('../utils/auditHelper');
const { currentUser, currentUserId } = require('../utils/requestUser');
const { roleSnapshot, permissionSnapshot, userSnapshot } = require('../utils/adminSecuritySnapshot');
const { buildBaseUrl } = require('../utils/requestBaseUrl');
const { generatePasswordReset } = require('./adminSecurityPassword.controller');
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

    await auditSafely(req, {
      userId: currentUserId(req),
      username: currentUser(req),
      action: 'CREATE_USER',
      actionCode: 'CREATE_USER',
      resultStatus: 'SUCCESS',
      entityType: 'USER',
      entityId: item.userId,
      entityName: item.username,
      summary: `Usuario creado: ${item.username}`,
      oldValues: null,
      newValues: userSnapshot(item),
      details: {
        createdUsername: item.username,
        initialRoles: roleSnapshot(item),
        passwordSetupLinkGenerated: true
      }
    });

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
    const userId = Number(req.params.userId);
    const before = await repository.findUserById(userId);
    await repository.replaceUserRoles(userId, req.body.roleIds || [], currentUser(req));
    const after = await repository.findUserById(userId);

    await auditSafely(req, {
      userId: currentUserId(req),
      username: currentUser(req),
      action: 'ASSIGN_ROLE',
      actionCode: 'ASSIGN_ROLE',
      resultStatus: 'SUCCESS',
      entityType: 'USER',
      entityId: userId,
      entityName: after?.username || before?.username || String(userId),
      summary: `Roles actualizados para ${after?.username || before?.username || userId}`,
      oldValues: { roles: roleSnapshot(before) },
      newValues: { roles: roleSnapshot(after) },
      details: { requestedRoleIds: req.body.roleIds || [] }
    });

    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function replaceChainPermissions(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const before = await repository.findUserById(userId);
    await repository.replaceScopePermissions({
      userId,
      roleId: Number(req.body.roleId),
      scopeType: 'CHAIN',
      ids: req.body.chainIds || [],
      isReadOnly: req.body.isReadOnly || 'N',
      createdBy: currentUser(req)
    });
    const after = await repository.findUserById(userId);

    await auditSafely(req, {
      userId: currentUserId(req),
      username: currentUser(req),
      action: 'ASSIGN_SCOPE',
      actionCode: 'ASSIGN_SCOPE',
      resultStatus: 'SUCCESS',
      entityType: 'USER_PERMISSION',
      entityId: userId,
      entityName: after?.username || before?.username || String(userId),
      summary: `Permisos de cadena actualizados para ${after?.username || before?.username || userId}`,
      oldValues: { chainPermissions: permissionSnapshot(before, 'CHAIN') },
      newValues: { chainPermissions: permissionSnapshot(after, 'CHAIN') },
      details: { scopeType: 'CHAIN', roleId: Number(req.body.roleId), chainIds: req.body.chainIds || [], isReadOnly: req.body.isReadOnly || 'N' }
    });

    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function replaceHotelPermissions(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const before = await repository.findUserById(userId);
    await repository.replaceScopePermissions({
      userId,
      roleId: Number(req.body.roleId),
      scopeType: 'HOTEL',
      ids: req.body.hotelIds || [],
      isReadOnly: req.body.isReadOnly || 'N',
      createdBy: currentUser(req)
    });
    const after = await repository.findUserById(userId);

    await auditSafely(req, {
      userId: currentUserId(req),
      username: currentUser(req),
      action: 'ASSIGN_SCOPE',
      actionCode: 'ASSIGN_SCOPE',
      resultStatus: 'SUCCESS',
      entityType: 'USER_PERMISSION',
      entityId: userId,
      entityName: after?.username || before?.username || String(userId),
      summary: `Permisos de hotel actualizados para ${after?.username || before?.username || userId}`,
      oldValues: { hotelPermissions: permissionSnapshot(before, 'HOTEL') },
      newValues: { hotelPermissions: permissionSnapshot(after, 'HOTEL') },
      details: { scopeType: 'HOTEL', roleId: Number(req.body.roleId), hotelIds: req.body.hotelIds || [], isReadOnly: req.body.isReadOnly || 'N' }
    });

    res.json({ ok: true });
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
