const repository = require('../repositories/adminSecurity.repository');
const { auditSafely } = require('../utils/auditHelper');
const { currentUser, currentUserId } = require('../utils/requestUser');
const { buildBaseUrl } = require('../utils/requestBaseUrl');

async function generatePasswordReset(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const item = await repository.findUserById(userId);
    if (!item) return res.status(404).json({ message: 'Usuario no encontrado' });

    const token = await repository.createPasswordResetToken(userId, currentUser(req));
    const resetUrl = `${buildBaseUrl(req)}/set-password.html?token=${encodeURIComponent(token)}`;

    await auditSafely(req, {
      userId: currentUserId(req),
      username: currentUser(req),
      action: 'RESET_PASSWORD',
      actionCode: 'RESET_PASSWORD',
      resultStatus: 'SUCCESS',
      entityType: 'USER',
      entityId: userId,
      entityName: item.username,
      summary: `Reset password generado para ${item.username}`,
      oldValues: null,
      newValues: null,
      details: { targetUsername: item.username, resetLinkGenerated: true }
    });

    res.json({ ok: true, resetUrl });
  } catch (error) { next(error); }
}

module.exports = {
  generatePasswordReset
};
